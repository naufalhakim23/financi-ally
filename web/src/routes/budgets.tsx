import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { format, toMinor } from "@financially/domain/money";

import { Amount, formatAmount, formatMoney } from "@/components/money";
import { ProgressBar, textToneFor } from "@/components/progress";
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
import { Field } from "@/components/field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BudgetWithSpent } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  periodOf,
  useAccounts,
  useBudgets,
  useDeleteBudget,
  useSetBudget,
  useUpdateBudget,
} from "@/lib/queries";

// The spending plan: a monthly target per expense category, against what has
// actually been spent. The server computes `spent_minor`, so this screen is
// render plus one small form, the arithmetic that matters already happened
// where the ledger lives.

export function BudgetsRoute() {
  const { user } = useAuth();
  const base = user?.base_currency ?? "IDR";

  const now = useMemo(() => new Date(), []);
  const period = periodOf(now);

  const budgetsQ = useBudgets(period);
  const accountsQ = useAccounts();
  const del = useDeleteBudget();

  const [editing, setEditing] = useState<BudgetWithSpent | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BudgetWithSpent | null>(null);

  const rows = budgetsQ.data ?? [];
  const nameFor = (id: string) => accountsQ.accounts.find((a) => a.id === id)?.name ?? "—";

  const categories = accountsQ.accounts.filter((a) => a.type === "expense" && !a.archived);
  const budgeted = new Set(rows.map((b) => b.account_id));
  const available = categories.filter((a) => !budgeted.has(a.id));

  // Totals are summed in minor units of the *book's* base currency. A budget in
  // another currency would need an FX pass to belong in this figure, so the
  // server keeps budgets in the category's own currency and this total is only
  // meaningful because categories share the base currency in practice.
  const spentTotal = rows.reduce((s, b) => s + b.spent_minor, 0);
  const targetTotal = rows.reduce((s, b) => s + b.target_minor, 0);
  const overallPct = targetTotal > 0 ? (spentTotal / targetTotal) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title text-ink font-bold">The spending plan</h1>
        <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Set budget
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-label text-faint font-semibold uppercase">
            {period.slice(0, 7)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-caption text-faint">Total spent</p>
              <Amount currency={base} minor={spentTotal} size="lg" />
            </div>
            <div className="text-right">
              <p className="text-caption text-faint">Budget</p>
              <Amount currency={base} minor={targetTotal} size="base" tone="dim" />
            </div>
          </div>
          <ProgressBar pct={overallPct} />
          <p className={`text-amount-sm font-mono font-bold ${textToneFor(overallPct)}`}>
            {Math.round(overallPct)}% used
          </p>
        </CardContent>
      </Card>

      {budgetsQ.error ? (
        <ErrorState
          message="Couldn't load the spending plan."
          onRetry={() => void budgetsQ.refetch()}
        />
      ) : null}

      {budgetsQ.isPending ? (
        <Card>
          <CardContent>
            <LoadingRows rows={4} />
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Target className="size-7" strokeWidth={1.5} />}
              title="No budgets this month"
              hint="Set a monthly target on a category to see spent-vs-target here."
              action={
                <Button size="sm" onClick={() => setCreating(true)}>
                  Set budget
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-outline-variant divide-y">
              {rows.map((b) => {
                const pct = b.target_minor > 0 ? (b.spent_minor / b.target_minor) * 100 : 0;
                return (
                  <li key={b.id} className="space-y-2 px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="text-body text-ink block truncate font-medium">
                          {nameFor(b.account_id)}
                        </span>
                        <span className="text-mono-meta text-faint font-mono">
                          {formatMoney(b.currency, b.spent_minor)} of{" "}
                          {formatAmount(b.currency, b.target_minor)}
                        </span>
                      </span>
                      <span className={`text-amount-sm font-mono font-bold ${textToneFor(pct)}`}>
                        {Math.round(pct)}%
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit budget for ${nameFor(b.account_id)}`}
                        onClick={() => setEditing(b)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete budget for ${nameFor(b.account_id)}`}
                        onClick={() => setPendingDelete(b)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <ProgressBar pct={pct} />
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <BudgetDialog
        open={creating || editing !== null}
        budget={editing}
        period={period}
        available={available}
        nameFor={nameFor}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <Dialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this budget?</DialogTitle>
          </DialogHeader>
          <p className="text-body text-dim">
            {pendingDelete ? nameFor(pendingDelete.account_id) : "This category"} loses its monthly
            target. Spending already logged is not affected.
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
                  toast.error("Couldn't delete that budget.");
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

type Category = { id: string; name: string; currency: string };

/**
 * One dialog for both setting and editing a target.
 *
 * Editing pins the category (a budget belongs to the account it was created
 * for; moving it is a delete plus a create) and only the amount is in play.
 */
function BudgetDialog({
  open,
  budget,
  period,
  available,
  nameFor,
  onClose,
}: {
  open: boolean;
  budget: BudgetWithSpent | null;
  period: string;
  available: Category[];
  nameFor: (id: string) => string;
  onClose: () => void;
}) {
  const set = useSetBudget();
  const update = useUpdateBudget();
  const busy = set.isPending || update.isPending;

  const [accountId, setAccountId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Re-seeding on open rather than in an effect: the dialog is unmounted
  // between openings only in spirit, and an effect here would fight the user's
  // typing on every parent render.
  const [seeded, setSeeded] = useState<string | null>(null);
  const seedKey = budget?.id ?? "new";
  // Forget the seed on close, otherwise reopening the same budget (or "Set
  // budget" a second time) matches the old key and the form keeps the previous
  // session's typing instead of what is actually saved.
  if (!open && seeded !== null) setSeeded(null);
  if (open && seeded !== seedKey) {
    setSeeded(seedKey);
    setAccountId(budget?.account_id ?? null);
    setAmount(budget ? format(budget.currency, budget.target_minor) : "");
    setError(null);
  }

  const currency =
    budget?.currency ?? available.find((a) => a.id === accountId)?.currency ?? "IDR";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!budget && !accountId) return setError("Select a category");

    let minor: number;
    try {
      minor = toMinor(currency, amount);
    } catch {
      return setError("Enter a valid amount");
    }
    if (minor <= 0) return setError("Amount must be greater than zero");

    try {
      if (budget) await update.mutateAsync({ id: budget.id, targetMinor: minor });
      else await set.mutateAsync({ accountId: accountId as string, period, targetMinor: minor });
      onClose();
    } catch {
      setError("Couldn't save that. Check your connection and try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{budget ? "Edit budget" : "Set budget"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error ? <ErrorState message={error} /> : null}

          <div className="space-y-1.5">
            <Label className="text-label text-ink">Category</Label>
            {budget ? (
              <p className="bg-surface-container text-body text-ink rounded-md px-3 py-2">
                {nameFor(budget.account_id)}
              </p>
            ) : available.length === 0 ? (
              <p className="text-body text-dim">Every category already has a budget.</p>
            ) : (
              <Select value={accountId ?? undefined} onValueChange={setAccountId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Field
            label={`Monthly target (${currency})`}
            value={amount}
            inputMode="decimal"
            onChange={(e) => setAmount(e.target.value)}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
