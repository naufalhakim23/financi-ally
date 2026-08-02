import { Archive, ArchiveRestore, Plus, Wallet } from "lucide-react";
import { useState } from "react";

import { currencyError } from "@financially/domain/validate";

import { Field } from "@/components/field";
import { Amount } from "@/components/money";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HTTPError, type AccountType } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  useAccountBalances,
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useWording } from "@/lib/wording";

// The chart of accounts, grouped by what each kind of account is *for* rather
// than by its accounting type name — "Pockets" reads to someone who has never
// heard the word asset, and the type is still right underneath.

const GROUPS: { type: AccountType; title: string; hint: string }[] = [
  { type: "asset", title: "Pockets", hint: "cash, bank accounts, e-wallets" },
  { type: "liability", title: "Owed", hint: "credit cards and loans" },
  { type: "expense", title: "Categories", hint: "what you spend on" },
  { type: "income", title: "Income", hint: "where money comes from" },
];

export function PocketsRoute() {
  const { user } = useAuth();
  const { t } = useWording();
  const base = user?.base_currency ?? "IDR";

  const accountsQ = useAccounts();
  const balancesQ = useAccountBalances();
  const update = useUpdateAccount();

  const [showArchived, setShowArchived] = useState(false);

  const loading = accountsQ.isPending || balancesQ.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title text-ink font-bold">{t("buckets")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "Hide archived" : "Show archived"}
          </Button>
          <NewAccountDialog baseCurrency={base} />
        </div>
      </div>

      {accountsQ.error ? (
        <ErrorState
          message="Couldn't load your accounts."
          onRetry={() => void accountsQ.refetch()}
        />
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="p-4">
            <LoadingRows rows={6} />
          </CardContent>
        </Card>
      ) : accountsQ.accounts.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Wallet className="size-7" strokeWidth={1.5} />}
              title="No accounts yet"
              hint="Add a pocket for your cash or bank, then a category or two to spend into."
              action={<NewAccountDialog baseCurrency={base} />}
            />
          </CardContent>
        </Card>
      ) : (
        GROUPS.map((group) => {
          const rows = accountsQ.accounts.filter(
            (a) => a.type === group.type && (showArchived || !a.archived),
          );
          if (rows.length === 0) return null;
          return (
            <section key={group.type} className="space-y-2">
              <div className="px-1">
                <h2 className="text-headline text-ink font-semibold">{group.title}</h2>
                <p className="text-caption text-faint">{group.hint}</p>
              </div>
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-outline-variant divide-y">
                    {rows.map((account) => (
                      <li
                        key={account.id}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3",
                          account.archived && "opacity-60",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="text-body text-ink block truncate font-medium">
                            {account.name}
                          </span>
                          <span className="text-caption text-faint font-mono">
                            {account.currency}
                            {account.archived ? " · archived" : ""}
                          </span>
                        </span>
                        <Amount
                          currency={account.currency}
                          minor={balancesQ.balanceOf(account)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={update.isPending}
                          aria-label={account.archived ? "Restore account" : "Archive account"}
                          onClick={() =>
                            update.mutate({ id: account.id, archived: !account.archived })
                          }
                        >
                          {account.archived ? (
                            <ArchiveRestore className="size-4" />
                          ) : (
                            <Archive className="size-4" />
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          );
        })
      )}
    </div>
  );
}

const TYPES: { value: AccountType; label: string }[] = [
  { value: "asset", label: "Pocket (cash, bank, e-wallet)" },
  { value: "expense", label: "Category (what you spend on)" },
  { value: "income", label: "Income source" },
  { value: "liability", label: "Card or loan" },
];

function NewAccountDialog({ baseCurrency }: { baseCurrency: string }) {
  const create = useCreateAccount();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("asset");
  const [currency, setCurrency] = useState(baseCurrency);
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const nameErr = touched && !name.trim() ? "Give it a name" : null;
  const currencyErr = touched ? currencyError(currency, { required: true }) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setFailure(null);
    if (!name.trim() || currencyError(currency, { required: true })) return;

    try {
      await create.mutateAsync({
        type,
        name: name.trim(),
        currency: currency.trim().toUpperCase(),
      });
      setOpen(false);
      setName("");
      setTouched(false);
    } catch (err) {
      setFailure(
        err instanceof HTTPError && err.status === 409
          ? "You already have one of these with that name."
          : "Couldn't create it. Check your connection and try again.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          New account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {failure ? <ErrorState message={failure} /> : null}

          <div className="space-y-1.5">
            <Label className="text-label text-ink">Kind</Label>
            <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Field
            label="Name"
            value={name}
            error={nameErr}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label="Currency"
            value={currency}
            error={currencyErr}
            maxLength={3}
            hint="the currency this account holds — it can't change later"
            onChange={(e) => setCurrency(e.target.value)}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
