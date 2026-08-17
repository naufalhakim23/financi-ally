import { Archive, ArchiveRestore, Wallet } from "lucide-react";
import { useState } from "react";

import { Amount } from "@/components/money";
import { NewAccountDialog } from "@/components/new-account-dialog";
import { EmptyState, ErrorState, LoadingRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AccountType } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAccountBalances, useAccounts, useUpdateAccount } from "@/lib/queries";
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
