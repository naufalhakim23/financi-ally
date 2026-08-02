import type { Account, JournalLine } from "./types";

// Signed balance for an account in its normal direction (asset/expense positive
// on debit; liability/income/equity positive on credit). Mirrors the backend's
// Balance.SignedMinor so the UI shows the same numbers.
export function accountSigned(account: Account, lines: JournalLine[]): number {
  const mine = lines.filter((l) => l.accountId === account.id);
  const debit = mine.filter((l) => l.dc === "debit").reduce((s, l) => s + l.amountMinor, 0);
  const credit = mine.filter((l) => l.dc === "credit").reduce((s, l) => s + l.amountMinor, 0);
  const isDebitNormal = account.type === "asset" || account.type === "expense";
  return isDebitNormal ? debit - credit : credit - debit;
}

// Net worth = Σ asset balances − Σ liability balances.
export function netWorth(accounts: Account[], lines: JournalLine[]): number {
  const assets = accounts.filter((a) => a.type === "asset").reduce((s, a) => s + accountSigned(a, lines), 0);
  const liabilities = accounts
    .filter((a) => a.type === "liability")
    .reduce((s, a) => s + accountSigned(a, lines), 0);
  return assets - liabilities;
}
