import { Pencil, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { format, toMinor } from "@financially/domain/money";
import {
  MAX_MONTH_DAY,
  WEEKDAYS,
  buildRRule,
  describeRRule,
  parseRRule,
  type Freq,
} from "@financially/domain/recurrence";

import { Field } from "@/components/field";
import { Amount } from "@/components/money";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { RecurringRule, RecurringTemplate } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  useAccounts,
  useDeleteRecurring,
  useRecurring,
  useSaveRecurring,
  useTriggerRecurring,
} from "@/lib/queries";

// Repeating entries: rent, a subscription, salary. The server materializes them
// on schedule; this screen authors the rule and offers a "don't wait" button.

function formatDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * The expense leg is the debit and the pocket is the credit, the same shape
 * the add-entry form builds for a one-off expense.
 */
function buildTemplate(
  currency: string,
  categoryId: string,
  pocketId: string,
  amountMinor: number,
  memo: string,
): RecurringTemplate {
  return {
    currency,
    memo,
    source: "recurring",
    lines: [
      { account_id: categoryId, dc: "debit", amount_minor: amountMinor },
      { account_id: pocketId, dc: "credit", amount_minor: amountMinor },
    ],
  };
}

export function RecurringRoute() {
  const rulesQ = useRecurring();
  const accountsQ = useAccounts();
  const trigger = useTriggerRecurring();
  const del = useDeleteRecurring();

  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<RecurringRule | null>(null);

  const rules = rulesQ.data ?? [];
  const active = rules.filter((r) => r.active);
  const nameFor = (id: string) => accountsQ.accounts.find((a) => a.id === id)?.name ?? "—";

  async function runDue() {
    try {
      const res = await trigger.mutateAsync();
      toast.success(
        res.count > 0
          ? `Posted ${res.count} ${res.count === 1 ? "entry" : "entries"}`
          : "Nothing due right now",
      );
    } catch {
      toast.error("Couldn't run the due entries.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title text-ink font-bold">Repeating entries</h1>
        <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New recurring
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-label text-faint font-semibold uppercase">Scheduled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-amount-lg text-ink font-mono font-bold">{active.length} active</p>
          <p className="text-caption text-faint">entries post automatically on their date</p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={trigger.isPending}
            onClick={() => void runDue()}
          >
            <Play className="size-3.5" />
            {trigger.isPending ? "Running…" : "Run due now"}
          </Button>
        </CardContent>
      </Card>

      {rulesQ.error ? (
        <ErrorState
          message="Couldn't load your repeating entries."
          onRetry={() => void rulesQ.refetch()}
        />
      ) : null}

      {rulesQ.isPending ? (
        <Card>
          <CardContent>
            <LoadingRows rows={3} />
          </CardContent>
        </Card>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Repeat className="size-7" strokeWidth={1.5} />}
              title="Nothing recurring yet"
              hint="Add rent, a subscription, or salary and it posts itself on schedule."
              action={
                <Button size="sm" onClick={() => setCreating(true)}>
                  New recurring
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-outline-variant divide-y">
              {rules.map((rule) => {
                const debit = rule.template.lines.find((l) => l.dc === "debit");
                const credit = rule.template.lines.find((l) => l.dc === "credit");
                return (
                  <li key={rule.id} className="space-y-1.5 px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="text-body text-ink block truncate font-medium">
                          {rule.template.memo || nameFor(debit?.account_id ?? "")}
                          {!rule.active ? (
                            <span className="text-caption text-faint ml-2 font-normal">Paused</span>
                          ) : null}
                        </span>
                        <span className="text-caption text-faint">
                          {describeRRule(rule.rrule)} · from {nameFor(credit?.account_id ?? "")}
                        </span>
                      </span>
                      <span className="flex flex-col items-end">
                        <Amount
                          currency={rule.template.currency}
                          minor={debit?.amount_minor ?? null}
                          size="sm"
                        />
                        <span className="text-mono-meta text-faint font-mono">
                          next {formatDate(rule.next_run)}
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit rule"
                        onClick={() => setEditing(rule)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete rule"
                        onClick={() => setPendingDelete(rule)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    {/* A rule that keeps failing (an archived account, say) has
                        to be visible here, otherwise it silently stops posting
                        and the user's plan is quietly wrong. */}
                    {rule.last_error ? (
                      <p className="text-caption text-error-strong">
                        Last run failed: {rule.last_error}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <RuleDialog
        open={creating || editing !== null}
        rule={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <Dialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this rule?</DialogTitle>
          </DialogHeader>
          <p className="text-body text-dim">
            &ldquo;{pendingDelete?.template.memo || "This rule"}&rdquo; stops posting. Entries it
            already created stay in the ledger.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={async () => {
                if (!pendingDelete) return;
                try {
                  await del.mutateAsync(pendingDelete.id);
                  setPendingDelete(null);
                } catch {
                  toast.error("Couldn't delete that rule.");
                }
              }}
            >
              {del.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const FREQS: { value: Freq; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function RuleDialog({
  open,
  rule,
  onClose,
}: {
  open: boolean;
  rule: RecurringRule | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const base = user?.base_currency ?? "IDR";
  const accountsQ = useAccounts();
  const save = useSaveRecurring();

  const categories = accountsQ.accounts.filter((a) => a.type === "expense" && !a.archived);
  const pockets = accountsQ.accounts.filter(
    (a) => (a.type === "asset" || a.type === "liability") && !a.archived,
  );

  const [freq, setFreq] = useState<Freq>("monthly");
  const [monthDay, setMonthDay] = useState(1);
  const [weekDay, setWeekDay] = useState("MO");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [pocketId, setPocketId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Seed from the rule being edited on open. Done during render against a key
  // rather than in an effect so it cannot fight the user's typing on a later
  // parent re-render.
  const [seeded, setSeeded] = useState<string | null>(null);
  const seedKey = rule?.id ?? "new";
  // Forget the seed on close, otherwise reopening the same rule (or "New
  // recurring" a second time) matches the old key and the form keeps the
  // previous session's typing instead of what is actually saved.
  if (!open && seeded !== null) setSeeded(null);
  if (open && seeded !== seedKey) {
    setSeeded(seedKey);
    setError(null);
    if (rule) {
      const parsed = parseRRule(rule.rrule);
      const debit = rule.template.lines.find((l) => l.dc === "debit");
      const credit = rule.template.lines.find((l) => l.dc === "credit");
      setFreq(parsed.freq);
      setMonthDay(parsed.monthDay);
      setWeekDay(parsed.weekDay);
      setCategoryId(debit?.account_id ?? null);
      setPocketId(credit?.account_id ?? null);
      setAmount(debit ? format(rule.template.currency, debit.amount_minor) : "");
      setMemo(rule.template.memo ?? "");
    } else {
      const today = new Date().getDate();
      setFreq("monthly");
      setMonthDay(today > MAX_MONTH_DAY ? 1 : today);
      setWeekDay("MO");
      setCategoryId(null);
      setPocketId(null);
      setAmount("");
      setMemo("");
    }
  }

  const currency = accountsQ.accounts.find((a) => a.id === categoryId)?.currency ?? base;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!categoryId) return setError("Select a category");
    if (!pocketId) return setError("Select a pocket to pay from");

    // A rule whose two legs sit in different currencies would need an FX rate
    // at post time, which the materializer has no way to pick. Blocked here
    // rather than failing silently every month.
    const pocketCurrency = accountsQ.accounts.find((a) => a.id === pocketId)?.currency;
    if (pocketCurrency && pocketCurrency !== currency) {
      return setError("Category and pocket must use the same currency");
    }

    let minor: number;
    try {
      minor = toMinor(currency, amount);
    } catch {
      return setError("Enter a valid amount");
    }
    if (minor <= 0) return setError("Amount must be greater than zero");

    try {
      await save.mutateAsync({
        id: rule?.id,
        rrule: buildRRule({ freq, monthDay, weekDay }),
        template: buildTemplate(currency, categoryId, pocketId, minor, memo),
        active: rule?.active ?? true,
      });
      onClose();
    } catch {
      setError("Couldn't save that. Check your connection and try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit recurring" : "New recurring"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error ? <ErrorState message={error} /> : null}

          <Picker
            label="How often"
            value={freq}
            options={FREQS}
            onChange={(v) => setFreq(v as Freq)}
          />

          {freq === "weekly" ? (
            <Picker label="On" value={weekDay} options={WEEKDAYS} onChange={setWeekDay} />
          ) : null}

          {freq === "monthly" ? (
            <Picker
              label="Day of month"
              value={String(monthDay)}
              options={Array.from({ length: MAX_MONTH_DAY }, (_, i) => ({
                value: String(i + 1),
                label: String(i + 1),
              }))}
              onChange={(v) => setMonthDay(Number(v))}
            />
          ) : null}

          <Picker
            label="Category"
            value={categoryId ?? ""}
            placeholder="Pick a category"
            options={categories.map((a) => ({ value: a.id, label: a.name }))}
            onChange={setCategoryId}
          />

          <Picker
            label="Pay from"
            value={pocketId ?? ""}
            placeholder="Pick a pocket"
            options={pockets.map((a) => ({ value: a.id, label: a.name }))}
            onChange={setPocketId}
          />

          <Field
            label={`Amount (${currency})`}
            value={amount}
            inputMode="decimal"
            onChange={(e) => setAmount(e.target.value)}
          />

          <Field
            label="Memo"
            value={memo}
            placeholder="Rent"
            maxLength={140}
            onChange={(e) => setMemo(e.target.value)}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A labelled Select, this form has five of them and they were all the same. */
function Picker({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-label text-ink">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
