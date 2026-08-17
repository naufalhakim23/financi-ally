import { CreditCard, Layers, Wallet } from "lucide-react";

import type { Account } from "@financially/domain/types";
import { convert, rateCaption, type RateTable } from "@financially/domain/fx";

import { Amount } from "@/components/money";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Where the money sits, and which of it the ledger beside this is showing.
//
// The hi-fi drafts drew each account as a payment card, complete with a masked
// PAN and an expiry. Nothing in the API carries any of that — it would have to
// be invented — and invented card numbers in a ledger is the one decoration
// that could make a user act on something untrue. The selection model survived;
// the card chrome did not.

/** `null` means every account — the panel's default. */
export type AccountSelection = string | null;

function balanceInBase(
  account: Account,
  balance: number,
  base: string,
  rates: RateTable,
): number | null {
  return account.currency === base ? balance : convert(balance, account.currency, base, rates);
}

function Row({
  icon,
  name,
  caption,
  selected,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  name: string;
  caption: string;
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={cn(
          "focus-visible:ring-focus-ring flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:-outline-offset-2",
          selected ? "bg-surface-container" : "hover:bg-surface-pressed",
        )}
      >
        <span className="bg-surface-container-high text-dim grid size-9 shrink-0 place-items-center rounded-lg">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-body text-ink block truncate font-semibold">{name}</span>
          <span className="text-caption text-faint block truncate">{caption}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">{children}</span>
      </button>
    </li>
  );
}

export function AccountPanel({
  accounts,
  balanceOf,
  base,
  rates,
  netTotal,
  selected,
  onSelect,
  className,
}: {
  className?: string;
  /** Asset and liability accounts only — categories are not places money sits. */
  accounts: Account[];
  balanceOf: (account: Account) => number;
  base: string;
  rates: RateTable;
  /** Whole-book net worth from the server, for the "all accounts" row. */
  netTotal: number | null;
  selected: AccountSelection;
  onSelect: (selection: AccountSelection) => void;
}) {
  const active = selected ? (accounts.find((a) => a.id === selected) ?? null) : null;
  const activeBalance = active ? balanceOf(active) : null;
  const activeBase =
    active && activeBalance != null ? balanceInBase(active, activeBalance, base, rates) : null;

  return (
    <Card className={cn("gap-0 overflow-hidden py-0", className)}>
      <div className="border-outline flex flex-col gap-1.5 border-b px-4 py-4">
        <span className="text-overline text-faint font-semibold tracking-wide uppercase">
          {active ? "Selected account" : "All accounts"}
        </span>
        <span className="text-body-lg text-ink truncate font-semibold">
          {active ? active.name : `${accounts.length} accounts`}
        </span>
        {active ? (
          <>
            <Amount currency={active.currency} minor={activeBalance} size="hero" />
            {active.currency !== base ? (
              <span className="flex items-baseline gap-2">
                <Amount currency={base} minor={activeBase} size="sm" tone="dim" />
                <span className="text-caption text-warning-strong">
                  {rateCaption(active.currency, base, rates) ?? "no rate available"}
                </span>
              </span>
            ) : null}
          </>
        ) : (
          <>
            <Amount currency={base} minor={netTotal} size="hero" />
            <span className="text-caption text-faint">assets minus what you owe, today</span>
          </>
        )}
      </div>

      <ul className="divide-outline-variant divide-y">
        <Row
          icon={<Layers className="size-4" strokeWidth={1.75} />}
          name="All accounts"
          caption="every entry in the book"
          selected={selected === null}
          onClick={() => onSelect(null)}
        >
          <Amount currency={base} minor={netTotal} size="sm" />
        </Row>

        {accounts.map((account) => {
          const balance = balanceOf(account);
          return (
            <Row
              key={account.id}
              icon={
                account.type === "liability" ? (
                  <CreditCard className="size-4" strokeWidth={1.75} />
                ) : (
                  <Wallet className="size-4" strokeWidth={1.75} />
                )
              }
              name={account.name}
              caption={`${account.type === "liability" ? "owed" : "held"} · ${account.currency}`}
              selected={selected === account.id}
              onClick={() => onSelect(account.id)}
            >
              <Amount currency={account.currency} minor={balance} size="sm" />
              {account.currency !== base ? (
                <Amount
                  currency={base}
                  minor={balanceInBase(account, balance, base, rates)}
                  size="sm"
                  tone="dim"
                />
              ) : null}
            </Row>
          );
        })}
      </ul>
    </Card>
  );
}
