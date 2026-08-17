import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { toMinor, scale } from "@financially/domain/money";

import { Field } from "@/components/field";
import { NewAccountDialog } from "@/components/new-account-dialog";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HTTPError, type Account, type AccountType } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAccounts, usePostEntry } from "@/lib/queries";
import { cn } from "@/lib/utils";

// Add entry — a modal route over whatever the user was looking at, so recording
// a coffee doesn't lose their place in the ledger.
//
// The three directions are a UI affordance over one double-entry posting: every
// entry is a debit and a credit, and "out / in / move" only decides which kind
// of account sits on each side.

type Direction = "out" | "in" | "move";

const MONEY_TYPES = new Set(["asset", "liability"]);

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Which accounts belong on each side, given the direction.
 *
 * Each side also carries the kind it wants, so a side with nothing to offer can
 * say what is missing and create it in place instead of presenting an empty
 * select that can never be satisfied.
 */
function sidesFor(direction: Direction, accounts: Account[]) {
  const money = accounts.filter((a) => MONEY_TYPES.has(a.type) && !a.archived);
  const expense = accounts.filter((a) => a.type === "expense" && !a.archived);
  const income = accounts.filter((a) => a.type === "income" && !a.archived);
  const pocket = { kind: "asset" as AccountType, missing: "a pocket to pay from" };
  const pocketIn = { kind: "asset" as AccountType, missing: "a pocket to receive it" };
  switch (direction) {
    case "out":
      return {
        from: { accounts: money, label: "Out of", ...pocket },
        to: { accounts: expense, label: "Into", kind: "expense" as AccountType, missing: "a category to spend into" },
      };
    case "in":
      return {
        from: { accounts: income, label: "Source", kind: "income" as AccountType, missing: "an income source" },
        to: { accounts: money, label: "Into", ...pocketIn },
      };
    case "move":
      return {
        from: { accounts: money, label: "Out of", ...pocket },
        to: { accounts: money, label: "Into", ...pocketIn },
      };
  }
}

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: "out", label: "Out" },
  { value: "in", label: "In" },
  { value: "move", label: "Move" },
];

export function EntryNewRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const base = user?.base_currency ?? "IDR";
  const accountsQ = useAccounts();
  const { data: raw, isSuccess } = accountsQ;
  const post = usePostEntry();

  const accounts = useMemo(() => raw ?? [], [raw]);

  const [direction, setDirection] = useState<Direction>("out");
  const [amount, setAmount] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [date, setDate] = useState(todayISO);
  const [memo, setMemo] = useState("");
  const [failure, setFailure] = useState<string | null>(null);

  const sides = useMemo(() => sidesFor(direction, accounts), [direction, accounts]);
  const from = accounts.find((a) => a.id === fromId) ?? null;
  const to = accounts.find((a) => a.id === toId) ?? null;

  // The entry's currency is the pocket's: an expense category inherits whatever
  // the money account it was paid from is denominated in.
  const currency = (direction === "in" ? to?.currency : from?.currency) ?? "";

  // Cross-currency entries need an fx_rate the UI has no way to ask for yet, so
  // they're blocked rather than posted at a wrong rate. Mobile does the same.
  // Every direction, not just "move" — a category denominated differently from
  // the pocket paying it is the same unpostable entry.
  const currencyMismatch = !!from && !!to && from.currency !== to.currency;

  let amountError: string | null = null;
  if (amount.trim()) {
    try {
      if (currency) toMinor(currency, amount.trim());
    } catch {
      amountError =
        currency && scale(currency) === 0
          ? `${currency} amounts are whole numbers`
          : "Enter a valid amount";
    }
  }

  const ready =
    !!from && !!to && !!currency && !!amount.trim() && !amountError && !currencyMismatch;

  function changeDirection(next: Direction) {
    setDirection(next);
    // The account lists change with the direction, so a kept selection could
    // silently mean a different kind of account.
    setFromId("");
    setToId("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFailure(null);
    if (!ready || !from || !to) return;

    const minor = toMinor(currency, amount.trim());
    try {
      // Debit where the money lands, credit where it left — the invariant the
      // server re-checks and the DB trigger enforces.
      await post.mutateAsync({
        currency,
        txn_date: date,
        memo: memo.trim(),
        lines: [
          { account_id: to.id, dc: "debit", amount_minor: minor },
          { account_id: from.id, dc: "credit", amount_minor: minor },
        ],
      });
      navigate(-1);
    } catch (err) {
      setFailure(
        err instanceof HTTPError && err.status === 422
          ? "That entry doesn't balance. Check the amount and try again."
          : err instanceof HTTPError && err.status === 400
            ? "Those accounts can't take this entry. Check their currencies."
            : "Couldn't save. Check your connection and try again.",
      );
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && navigate(-1)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add entry</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {failure ? <ErrorState message={failure} /> : null}
          {/* Without this the selects sit disabled forever with nothing to
              explain why: a failed account query renders the same as one that
              has not landed yet. */}
          {accountsQ.isError ? (
            <ErrorState
              message="Couldn't load your accounts."
              onRetry={() => void accountsQ.refetch()}
            />
          ) : null}

          <div role="radiogroup" aria-label="Direction" className="bg-surface-container inline-flex rounded-md p-0.5">
            {DIRECTIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                role="radio"
                aria-checked={direction === d.value}
                onClick={() => changeDirection(d.value)}
                className={cn(
                  "text-label rounded-[6px] px-4 py-1.5 transition-colors",
                  "focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none",
                  direction === d.value ? "bg-surface text-ink shadow-card font-semibold" : "text-dim",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>

          <Field
            label="Amount"
            inputMode="decimal"
            value={amount}
            error={amountError}
            hint={currency ? `in ${currency}` : "pick an account to set the currency"}
            onChange={(e) => setAmount(e.target.value)}
            className="tabular"
          />

          <AccountSelect
            side={sides.from}
            value={fromId}
            onChange={setFromId}
            loaded={isSuccess}
            baseCurrency={base}
          />
          <AccountSelect
            side={{ ...sides.to, accounts: sides.to.accounts.filter((a) => a.id !== fromId) }}
            value={toId}
            onChange={setToId}
            loaded={isSuccess}
            baseCurrency={base}
          />

          {currencyMismatch ? (
            <ErrorState
              message={`Those two accounts are in different currencies (${from?.currency} and ${to?.currency}). Cross-currency entries aren't supported here yet.`}
            />
          ) : null}

          <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Field
            label="Memo"
            value={memo}
            placeholder="optional"
            maxLength={500}
            onChange={(e) => setMemo(e.target.value)}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready || post.isPending}>
              {post.isPending ? "Saving…" : "Save entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Side = { accounts: Account[]; label: string; kind: AccountType; missing: string };

function AccountSelect({
  side,
  value,
  onChange,
  loaded,
  baseCurrency,
}: {
  side: Side;
  value: string;
  onChange: (id: string) => void;
  /** True once the accounts query has actually succeeded. */
  loaded: boolean;
  baseCurrency: string;
}) {
  const { accounts, label } = side;

  // An empty select here used to be the end of the road: Save could never
  // enable and the dialog offered no way to create what was missing.
  //
  // Only once the query has landed, though. Empty is also what a pending fetch
  // and a failed one look like, and claiming "you need a pocket first" at
  // someone who has six is a worse lie than a disabled select.
  if (loaded && accounts.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label className="text-label text-ink">{label}</Label>
        <div className="border-outline flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2.5">
          <p className="text-body text-dim">You need {side.missing} first.</p>
          <NewAccountDialog
            baseCurrency={baseCurrency}
            defaultType={side.kind}
            trigger={
              <Button type="button" size="sm" variant="outline">
                Create one
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-label text-ink">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={!loaded}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose an account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
              <span className="text-faint text-caption ml-2 font-mono">{a.currency}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
