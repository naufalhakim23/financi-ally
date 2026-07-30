import { useState } from "react";
import {
  Home, Plus, PieChart, Wallet, Bell, Globe,
  ChevronRight, ChevronLeft, ChevronDown,
  RefreshCw, Edit2, Trash2, Check,
  AlertTriangle, WifiOff, TrendingUp, Info,
  Signal, Battery, Wifi,
} from "lucide-react";

// ─── Design tokens (light palette) ─────────────────────────────────────────
// bg-surface   = #F2F3F7  page / screen background
// bg-card      = #FFFFFF  elevated card
// bg-field     = #F0F1F6  input fields / inner wells
// bg-pill      = #E8EAF2  muted pill backgrounds
// border       = #E2E6F0  hairline dividers
// text-ink     = #1A1F2E  primary text
// text-dim     = #6B738E  secondary / label text
// text-faint   = #9EA6BE  placeholder / caption
// clr-pos      = #16A34A  income / positive amounts
// clr-neg      = #DC2626  expense / negative amounts
// clr-warn     = #D97706  budget warnings
// clr-brand    = #1D6F42  primary brand green

type Screen = "dashboard" | "add" | "budgets" | "accounts" | "ledger" | "currencies";
type TxType = "expense" | "income" | "transfer";

// ─── Presentation meta ──────────────────────────────────────────────────────

const SCREENS: { id: Screen; label: string; desc: string }[] = [
  { id: "dashboard",  label: "Dashboard",       desc: "At-a-glance: net worth, accounts, recent activity" },
  { id: "add",        label: "Add Transaction", desc: "Double-entry form with multi-currency support" },
  { id: "budgets",    label: "Budgets",         desc: "Monthly envelope budgets with visual progress" },
  { id: "accounts",   label: "Accounts",        desc: "Chart of accounts — multi-currency with base conversion" },
  { id: "ledger",     label: "Ledger View",     desc: "Raw journal entry — the double-entry record" },
  { id: "currencies", label: "Currencies",      desc: "Offline exchange rate cache & manual override" },
];

const UX_NOTES: Record<Screen, { actions: string[]; decisions: string[] }> = {
  dashboard: {
    actions: ["Tap + FAB → Add Transaction", "Tap row → Ledger View", "Tap account chip → Account detail", "Pull to refresh (online only)"],
    decisions: ["Net worth unified in base currency (USD)", "Offline badge: app still fully usable", "Budget ring → amber at 75%, red at 95%"],
  },
  add: {
    actions: ["Toggle Expense / Income / Transfer", "Tap account fields → picker sheet", "Tap currency → currency selector", "Exchange rate auto-fills on mismatch"],
    decisions: ["'From / To' language hides debit/credit complexity", "Journal entry preview educates on double-entry", "Offline: locked to last cached rate with warning"],
  },
  budgets: {
    actions: ["◀ ▶ arrows → change month", "Tap row → category transactions", "Tap + → add budget category", "Long-press → edit / delete"],
    decisions: ["Budgets are envelope accounts in the ledger", "Amber at 75%, red at 100%+", "Rollover from previous month shown inline"],
  },
  accounts: {
    actions: ["Tap account → account detail", "Tap + → create account with currency", "Pull down → refresh rates (online)", "Long-press → archive / edit"],
    decisions: ["All foreign balances show ≈ base equivalent", "Credit cards shown as negative (liabilities)", "Investments marked ≈ (market estimate)"],
  },
  ledger: {
    actions: ["Tap Edit → modify transaction", "Delete → reversal entry (audit safe)", "Tap account name → jump to account"],
    decisions: ["Raw Debit / Credit columns for power users", "Soft delete: reversal entry preserves audit trail", "Immutable after 30 days unless unlocked"],
  },
  currencies: {
    actions: ["Tap rate → manual override", "Toggle auto-fetch → manual mode", "Tap + → add currency", "Tap base → change base currency"],
    decisions: ["All rates cached locally for offline use", "Manual override for cash exchange booth rates", "Base currency change recalculates all history"],
  },
};

// ─── Design system primitives ────────────────────────────────────────────────

/** Sectioned white card with optional padding */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-[#E2E6F0] ${className}`}
      style={{ boxShadow: "0 1px 4px rgba(26,31,46,0.06)" }}
    >
      {children}
    </div>
  );
}

/** ALL-CAPS section label */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-semibold uppercase tracking-widest text-[#9EA6BE]">{children}</p>
  );
}

/** Amount with automatic positive/negative coloring */
function Amount({ value, currency = "USD", size = "md" }: { value: number; currency?: string; size?: "sm" | "md" | "lg" }) {
  const pos = value >= 0;
  const sizes = { sm: "text-[12px]", md: "text-[14px]", lg: "text-[28px]" };
  return (
    <span
      className={`font-mono font-semibold ${sizes[size]} ${pos ? "text-[#16A34A]" : "text-[#DC2626]"}`}
    >
      {pos ? "+" : "−"}{Math.abs(value).toFixed(2)}&nbsp;{currency}
    </span>
  );
}

/** Rounded progress bar */
function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  const clipped = Math.min(pct, 100);
  const color = pct >= 100 ? "bg-[#DC2626]" : pct >= 75 ? "bg-[#D97706]" : "bg-[#16A34A]";
  return (
    <div className={`w-full h-1.5 rounded-full bg-[#E8EAF2] overflow-hidden ${className}`}>
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${clipped}%` }} />
    </div>
  );
}

/** Emoji icon inside a soft-tinted rounded square */
function IconBox({ emoji, bg = "bg-[#EEF0F6]" }: { emoji: string; bg?: string }) {
  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg} text-[16px]`}>
      {emoji}
    </div>
  );
}

// ─── Shared chrome ──────────────────────────────────────────────────────────

function DynamicIsland() {
  return (
    <div
      className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 rounded-full bg-[#1A1F2E]"
      style={{ width: 116, height: 32 }}
    />
  );
}

function StatusBar({ offline = false }: { offline?: boolean }) {
  return (
    <div className="flex items-center justify-between px-6 pt-11 pb-1">
      <span className="text-[11px] font-mono font-semibold text-[#6B738E]">9:41</span>
      <div className="flex items-center gap-1 text-[#6B738E]">
        {offline && <WifiOff size={10} className="text-[#D97706]" />}
        <Signal size={11} />
        <Wifi size={11} />
        <Battery size={12} />
      </div>
    </div>
  );
}

function BottomNav({ active, onNavigate }: { active: Screen; onNavigate: (s: Screen) => void }) {
  const item = (s: Screen, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => onNavigate(s)}
      className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${
        active === s ? "text-[#1D6F42]" : "text-[#9EA6BE]"
      }`}
    >
      {icon}
      <span className="text-[9px] font-semibold">{label}</span>
    </button>
  );
  return (
    <div
      className="flex items-center justify-around border-t border-[#E8EAF2] bg-white pb-5 pt-2 shrink-0"
      style={{ boxShadow: "0 -1px 0 #E2E6F0" }}
    >
      {item("dashboard",  <Home size={20} />,    "Home")}
      {item("budgets",    <PieChart size={20} />, "Budget")}
      <button
        onClick={() => onNavigate("add")}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-[#1D6F42] text-white -mt-5"
        style={{ boxShadow: "0 4px 16px rgba(29,111,66,0.35)" }}
      >
        <Plus size={22} />
      </button>
      {item("accounts",   <Wallet size={20} />, "Accounts")}
      {item("currencies", <Globe size={20} />,  "Rates")}
    </div>
  );
}

// ─── Screen: Dashboard ──────────────────────────────────────────────────────

function DashboardScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const transactions = [
    { name: "Noodle House Lunch",  account: "Chase Checking", amount: -47.50,  currency: "USD", icon: "🍜", bg: "bg-orange-50",  date: "Today" },
    { name: "Salary — Acme Corp",  account: "Chase Checking", amount: 4500,    currency: "USD", icon: "💼", bg: "bg-green-50",   date: "Today" },
    { name: "Amazon Order",        account: "Visa Platinum",  amount: -89.99,  currency: "USD", icon: "📦", bg: "bg-sky-50",     date: "Yesterday" },
    { name: "Grocery Run",         account: "Chase Checking", amount: -61.34,  currency: "USD", icon: "🛒", bg: "bg-lime-50",    date: "Yesterday" },
    { name: "Netflix",             account: "Amex Blue",      amount: -15.99,  currency: "USD", icon: "🎬", bg: "bg-red-50",     date: "Jul 25" },
    { name: "EUR Transfer",        account: "EUR Account",    amount: 500,     currency: "EUR", icon: "↔️", bg: "bg-violet-50",  date: "Jul 24" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F2F3F7]">
      <DynamicIsland />
      <StatusBar />

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-2 pb-3 bg-[#F2F3F7]">
        <div>
          <p className="text-[10px] font-semibold text-[#9EA6BE] uppercase tracking-widest">Good morning</p>
          <h1 className="text-[18px] font-semibold text-[#1A1F2E] leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
            Alex Chen
          </h1>
        </div>
        <button className="w-9 h-9 rounded-full bg-white border border-[#E2E6F0] flex items-center justify-center relative"
          style={{ boxShadow: "0 1px 3px rgba(26,31,46,0.08)" }}>
          <Bell size={16} className="text-[#6B738E]" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3" style={{ scrollbarWidth: "none" }}>

        {/* Net worth card */}
        <Card className="p-4">
          <SectionLabel>Net Worth · USD</SectionLabel>
          <p className="text-[32px] font-mono font-semibold text-[#1A1F2E] leading-tight mt-1">$12,847.23</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <TrendingUp size={13} className="text-[#16A34A]" />
            <span className="text-[11px] font-mono font-semibold text-[#16A34A]">+$234.50</span>
            <span className="text-[11px] text-[#9EA6BE]">this month</span>
          </div>
        </Card>

        {/* Accounts strip */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>Accounts</SectionLabel>
            <button className="text-[11px] font-semibold text-[#1D6F42]" onClick={() => onNavigate("accounts")}>
              See all
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            {[
              { name: "Chase Checking", bal: "$4,230",  icon: "🏦", tint: "bg-blue-50   border-blue-100" },
              { name: "EUR Account",    bal: "€1,200",  icon: "🇪🇺", tint: "bg-violet-50 border-violet-100" },
              { name: "Visa Platinum",  bal: "−$1,200", icon: "💳", tint: "bg-rose-50   border-rose-100" },
              { name: "Chase Savings",  bal: "$9,817",  icon: "💰", tint: "bg-green-50  border-green-100" },
            ].map(a => (
              <button
                key={a.name}
                className={`shrink-0 rounded-xl border px-3 py-2.5 text-left ${a.tint} bg-white`}
                style={{ boxShadow: "0 1px 3px rgba(26,31,46,0.06)" }}
              >
                <p className="text-[17px] mb-1">{a.icon}</p>
                <p className="text-[10px] text-[#9EA6BE] whitespace-nowrap font-medium">{a.name}</p>
                <p className={`text-[13px] font-mono font-semibold ${a.bal.startsWith("−") ? "text-[#DC2626]" : "text-[#1A1F2E]"}`}>
                  {a.bal}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Monthly budget */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>July Budget</SectionLabel>
            <span className="text-[11px] font-mono font-semibold text-[#D97706]">73% used</span>
          </div>
          <ProgressBar pct={73} />
          <div className="flex justify-between mt-1.5">
            <span className="text-[11px] font-mono text-[#6B738E]">$1,847 spent</span>
            <span className="text-[11px] font-mono text-[#9EA6BE]">$2,500 limit · 3 days</span>
          </div>
        </Card>

        {/* Recent transactions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>Recent</SectionLabel>
            <button className="text-[11px] font-semibold text-[#1D6F42]">View all</button>
          </div>
          <Card>
            {transactions.map((tx, i) => (
              <button
                key={i}
                onClick={() => onNavigate("ledger")}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left ${i < transactions.length - 1 ? "border-b border-[#F0F1F6]" : ""}`}
              >
                <IconBox emoji={tx.icon} bg={tx.bg} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1A1F2E] truncate">{tx.name}</p>
                  <p className="text-[10px] text-[#9EA6BE]">{tx.account} · {tx.date}</p>
                </div>
                <div className="text-right shrink-0">
                  <Amount value={tx.amount} currency={tx.currency} size="sm" />
                  {tx.currency !== "USD" && (
                    <p className="text-[10px] text-[#9EA6BE] font-mono">≈ ${(Math.abs(tx.amount) * 1.08).toFixed(2)}</p>
                  )}
                </div>
              </button>
            ))}
          </Card>
        </div>

      </div>

      <BottomNav active="dashboard" onNavigate={onNavigate} />
    </div>
  );
}

// ─── Screen: Add Transaction ────────────────────────────────────────────────

function AddScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [txType, setTxType] = useState<TxType>("expense");

  const tabActive = (t: TxType) => txType === t;
  const tabCls = (t: TxType) => {
    const base = "flex-1 py-2 rounded-xl text-[11px] font-semibold transition-all";
    if (!tabActive(t)) return `${base} text-[#9EA6BE]`;
    if (t === "expense")  return `${base} bg-white text-[#DC2626] border border-[#E2E6F0]`;
    if (t === "income")   return `${base} bg-white text-[#16A34A] border border-[#E2E6F0]`;
    return `${base} bg-white text-[#2563EB] border border-[#E2E6F0]`;
  };

  return (
    <div className="flex flex-col h-full bg-[#F2F3F7]">
      <DynamicIsland />
      <StatusBar />
      {/* Nav */}
      <div className="flex items-center justify-between px-5 pt-2 pb-3">
        <button
          onClick={() => onNavigate("dashboard")}
          className="w-8 h-8 rounded-full bg-white border border-[#E2E6F0] flex items-center justify-center"
          style={{ boxShadow: "0 1px 3px rgba(26,31,46,0.06)" }}
        >
          <ChevronLeft size={17} className="text-[#6B738E]" />
        </button>
        <h2 className="text-[15px] font-semibold text-[#1A1F2E]">New Transaction</h2>
        <button
          className="w-8 h-8 rounded-full bg-[#E8F5EE] flex items-center justify-center"
        >
          <Check size={16} className="text-[#1D6F42]" />
        </button>
      </div>

      {/* Type tabs */}
      <div className="mx-4 flex rounded-2xl bg-[#E8EAF2] p-1 mb-4 gap-1">
        {(["expense", "income", "transfer"] as TxType[]).map(t => (
          <button key={t} className={tabCls(t)} onClick={() => setTxType(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Form scroll */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4" style={{ scrollbarWidth: "none" }}>

        {/* Amount */}
        <Card className="p-4">
          <SectionLabel>Amount</SectionLabel>
          <div className="flex items-center gap-3 mt-2">
            <button className="flex items-center gap-1 rounded-xl bg-[#F0F1F6] px-2.5 py-2 shrink-0">
              <span className="text-[12px] font-mono font-semibold text-[#6B738E]">USD</span>
              <ChevronDown size={11} className="text-[#9EA6BE]" />
            </button>
            <p className="text-[36px] font-mono font-light text-[#1A1F2E] flex-1 leading-none">0.00</p>
          </div>
          <div className="mt-3 pt-3 border-t border-[#F0F1F6]">
            <span className="text-[10px] text-[#9EA6BE] font-mono">≈ 0.00 EUR · rate 0.9242 · cached offline</span>
          </div>
        </Card>

        {/* From account */}
        <Card className="p-4">
          <SectionLabel>{txType === "income" ? "To Account" : "From Account"}</SectionLabel>
          <button className="w-full flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-2.5">
              <IconBox emoji="🏦" bg="bg-blue-50" />
              <div className="text-left">
                <p className="text-[13px] font-semibold text-[#1A1F2E]">Chase Checking</p>
                <p className="text-[10px] font-mono text-[#9EA6BE]">$4,230.00 available</p>
              </div>
            </div>
            <ChevronRight size={15} className="text-[#C0C7DA]" />
          </button>
        </Card>

        {/* To / Category */}
        <Card className="p-4">
          <SectionLabel>
            {txType === "income" ? "Income Source" : txType === "transfer" ? "To Account" : "Category"}
          </SectionLabel>
          <button className="w-full flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-2.5">
              <IconBox emoji="🍜" bg="bg-orange-50" />
              <div className="text-left">
                <p className="text-[13px] font-semibold text-[#1A1F2E]">Food & Dining</p>
                <p className="text-[10px] text-[#9EA6BE]">$387 of $500 spent this month</p>
              </div>
            </div>
            <ChevronRight size={15} className="text-[#C0C7DA]" />
          </button>
        </Card>

        {/* Quick category grid */}
        <Card className="p-4">
          <SectionLabel>Quick Pick</SectionLabel>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {[
              { icon: "🍜", label: "Food",      sel: true },
              { icon: "🚗", label: "Transport", sel: false },
              { icon: "🏠", label: "Housing",   sel: false },
              { icon: "💊", label: "Health",    sel: false },
              { icon: "🎬", label: "Fun",       sel: false },
              { icon: "📱", label: "Tech",      sel: false },
              { icon: "✈️", label: "Travel",    sel: false },
              { icon: "🎓", label: "Education", sel: false },
            ].map(c => (
              <button
                key={c.label}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all ${
                  c.sel
                    ? "bg-[#E8F5EE] border border-[#A7D8B8]"
                    : "bg-[#F0F1F6] border border-transparent"
                }`}
              >
                <span className="text-[18px]">{c.icon}</span>
                <span className={`text-[9px] font-semibold ${c.sel ? "text-[#1D6F42]" : "text-[#9EA6BE]"}`}>
                  {c.label}
                </span>
              </button>
            ))}
          </div>
        </Card>

        {/* Description & Date */}
        <Card>
          <div className="px-4 py-3.5">
            <SectionLabel>Description</SectionLabel>
            <p className="text-[13px] text-[#9EA6BE] mt-1.5">Noodle House · team lunch</p>
          </div>
          <div className="border-t border-[#F0F1F6]" />
          <button className="w-full flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-2 text-[#6B738E]">
              <span className="text-[13px]">📅</span>
              <span className="text-[13px] font-medium">Today, Jul 28 2026</span>
            </div>
            <ChevronRight size={14} className="text-[#C0C7DA]" />
          </button>
        </Card>

        {/* Journal entry preview */}
        <div className="rounded-2xl border border-[#A7D8B8] bg-[#F0FAF4] p-4">
          <p className="text-[9px] text-[#1D6F42] font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Info size={10} /> Journal Entry Preview
          </p>
          <div className="rounded-xl overflow-hidden border border-[#D1EDD9]">
            <div className="grid bg-[#E8F5EE] px-3 py-2" style={{ gridTemplateColumns: "1fr 3.5rem 3.5rem" }}>
              <p className="text-[9px] text-[#6B9E7A] font-semibold">Account</p>
              <p className="text-[9px] text-[#6B9E7A] font-semibold text-right">Debit</p>
              <p className="text-[9px] text-[#6B9E7A] font-semibold text-right">Credit</p>
            </div>
            <div className="grid px-3 py-2.5 bg-white border-t border-[#D1EDD9]" style={{ gridTemplateColumns: "1fr 3.5rem 3.5rem" }}>
              <p className="text-[11px] font-medium text-[#1A1F2E]">Chase Checking</p>
              <p className="text-[11px] font-mono text-[#DC2626] text-right">$0.00</p>
              <p className="text-[11px] font-mono text-[#C0C7DA] text-right">—</p>
            </div>
            <div className="grid px-3 py-2.5 bg-white border-t border-[#D1EDD9]" style={{ gridTemplateColumns: "1fr 3.5rem 3.5rem" }}>
              <p className="text-[11px] font-medium text-[#1A1F2E]">Food & Dining</p>
              <p className="text-[11px] font-mono text-[#C0C7DA] text-right">—</p>
              <p className="text-[11px] font-mono text-[#DC2626] text-right">$0.00</p>
            </div>
          </div>
          <p className="text-[10px] text-[#6B9E7A] mt-2">Debits = Credits · balanced ✓</p>
        </div>
      </div>

      {/* Save */}
      <div className="px-4 pb-6 pt-3 bg-[#F2F3F7]">
        <button
          className="w-full py-4 rounded-2xl bg-[#1D6F42] text-[14px] font-bold text-white"
          style={{ boxShadow: "0 4px 16px rgba(29,111,66,0.28)" }}
        >
          Save Transaction
        </button>
      </div>
    </div>
  );
}

// ─── Screen: Budgets ────────────────────────────────────────────────────────

function BudgetsScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const cats = [
    { icon: "🏠", name: "Housing",       spent: 1200, budget: 1200, bg: "bg-blue-50" },
    { icon: "🍜", name: "Food & Dining", spent: 387,  budget: 500,  bg: "bg-orange-50" },
    { icon: "🎬", name: "Entertainment", spent: 100,  budget: 150,  bg: "bg-purple-50" },
    { icon: "🚗", name: "Transport",     spent: 112,  budget: 200,  bg: "bg-sky-50" },
    { icon: "💊", name: "Healthcare",    spent: 48,   budget: 150,  bg: "bg-red-50" },
    { icon: "📱", name: "Subscriptions", spent: 45,   budget: 60,   bg: "bg-indigo-50" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F2F3F7]">
      <DynamicIsland />
      <StatusBar />
      <div className="flex items-center justify-between px-5 pt-2 pb-3">
        <button className="w-8 h-8 flex items-center justify-center text-[#9EA6BE]">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h2 className="text-[15px] font-semibold text-[#1A1F2E]">Budgets</h2>
          <p className="text-[10px] text-[#9EA6BE]">July 2026</p>
        </div>
        <button className="w-8 h-8 flex items-center justify-center text-[#9EA6BE]">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4" style={{ scrollbarWidth: "none" }}>

        {/* Summary */}
        <Card className="p-4">
          <div className="flex justify-between items-end mb-3">
            <div>
              <SectionLabel>Total Spent</SectionLabel>
              <p className="text-[28px] font-mono font-semibold text-[#1A1F2E] mt-1 leading-none">$1,892</p>
            </div>
            <div className="text-right">
              <SectionLabel>Budget</SectionLabel>
              <p className="text-[22px] font-mono font-medium text-[#9EA6BE] mt-1 leading-none">$2,260</p>
            </div>
          </div>
          <ProgressBar pct={83.7} />
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] font-mono font-semibold text-[#D97706]">83.7% used</span>
            <span className="text-[10px] font-mono text-[#9EA6BE]">$368 left · 3 days</span>
          </div>
        </Card>

        {/* Category list */}
        <Card>
          {cats.map((cat, i) => {
            const pct = Math.round((cat.spent / cat.budget) * 100);
            const over = pct >= 100;
            const warn = pct >= 75 && !over;
            return (
              <button
                key={cat.name}
                className={`w-full flex flex-col px-4 py-3.5 text-left ${i < cats.length - 1 ? "border-b border-[#F0F1F6]" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <IconBox emoji={cat.icon} bg={cat.bg} />
                    <div>
                      <p className="text-[13px] font-semibold text-[#1A1F2E]">{cat.name}</p>
                      <p className="text-[10px] font-mono text-[#9EA6BE]">${cat.spent} / ${cat.budget}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {over && <AlertTriangle size={12} className="text-[#DC2626]" />}
                    <span className={`text-[12px] font-mono font-bold ${over ? "text-[#DC2626]" : warn ? "text-[#D97706]" : "text-[#16A34A]"}`}>
                      {pct}%
                    </span>
                    <ChevronRight size={13} className="text-[#C0C7DA]" />
                  </div>
                </div>
                <ProgressBar pct={pct} />
              </button>
            );
          })}
        </Card>

        {/* Add */}
        <button className="w-full rounded-2xl border border-dashed border-[#C0C7DA] bg-white py-3.5 flex items-center justify-center gap-2 text-[#9EA6BE]">
          <Plus size={14} />
          <span className="text-[12px] font-semibold">Add Budget Category</span>
        </button>
      </div>

      <BottomNav active="budgets" onNavigate={onNavigate} />
    </div>
  );
}

// ─── Screen: Accounts ───────────────────────────────────────────────────────

function AccountsScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const groups = [
    {
      label: "Cash & Checking", subtotal: "$4,350.00", neg: false,
      accounts: [
        { icon: "💵", name: "Wallet Cash",    bal: "$120.00",   sub: null, bg: "bg-green-50" },
        { icon: "🏦", name: "Chase Checking", bal: "$4,230.00", sub: null, bg: "bg-blue-50" },
      ],
    },
    {
      label: "Savings", subtotal: "$9,817.00", neg: false,
      accounts: [
        { icon: "💰", name: "Chase Savings", bal: "$9,817.00", sub: null, bg: "bg-emerald-50" },
      ],
    },
    {
      label: "Credit Cards", subtotal: "−$1,319.77", neg: true,
      accounts: [
        { icon: "💳", name: "Visa Platinum", bal: "−$1,200.00", sub: null, bg: "bg-rose-50" },
        { icon: "💳", name: "Amex Blue",     bal: "−$119.77",   sub: null, bg: "bg-orange-50" },
      ],
    },
    {
      label: "Investments", subtotal: "$8,500.00", neg: false,
      accounts: [
        { icon: "📈", name: "Fidelity 401k", bal: "$8,500.00", sub: "≈ est.", bg: "bg-sky-50" },
      ],
    },
    {
      label: "Foreign Currency", subtotal: "≈ $1,935.50", neg: false,
      accounts: [
        { icon: "🇪🇺", name: "EUR Account", bal: "€1,200.00", sub: "≈ $1,299.00", bg: "bg-violet-50" },
        { icon: "🇬🇧", name: "GBP Account", bal: "£500.00",   sub: "≈ $636.50",   bg: "bg-indigo-50" },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F2F3F7]">
      <DynamicIsland />
      <StatusBar />
      <div className="flex items-center justify-between px-5 pt-2 pb-3">
        <h2 className="text-[17px] font-semibold text-[#1A1F2E]">Accounts</h2>
        <button
          className="w-8 h-8 rounded-full bg-white border border-[#E2E6F0] flex items-center justify-center"
          style={{ boxShadow: "0 1px 3px rgba(26,31,46,0.06)" }}
        >
          <Plus size={16} className="text-[#6B738E]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4" style={{ scrollbarWidth: "none" }}>
        {/* Net worth */}
        <Card className="px-4 py-3.5">
          <SectionLabel>Net Worth · USD</SectionLabel>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[26px] font-mono font-semibold text-[#1A1F2E] leading-none">$23,282.73</p>
            <div className="flex items-center gap-1 text-[#16A34A]">
              <TrendingUp size={13} />
              <span className="text-[12px] font-mono font-semibold">+1.85%</span>
            </div>
          </div>
        </Card>

        {/* Groups */}
        {groups.map(g => (
          <Card key={g.label}>
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#F8F9FC] border-b border-[#F0F1F6] rounded-t-2xl">
              <SectionLabel>{g.label}</SectionLabel>
              <p className={`text-[11px] font-mono font-bold ${g.neg ? "text-[#DC2626]" : "text-[#1A1F2E]"}`}>
                {g.subtotal}
              </p>
            </div>
            {g.accounts.map((a, i) => (
              <button
                key={a.name}
                className={`w-full flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-[#F0F1F6]" : ""}`}
              >
                <div className="flex items-center gap-2.5">
                  <IconBox emoji={a.icon} bg={a.bg} />
                  <p className="text-[13px] font-medium text-[#1A1F2E]">{a.name}</p>
                </div>
                <div className="text-right">
                  <p className={`text-[13px] font-mono font-semibold ${a.bal.startsWith("−") ? "text-[#DC2626]" : "text-[#1A1F2E]"}`}>
                    {a.bal}
                  </p>
                  {a.sub && <p className="text-[10px] font-mono text-[#9EA6BE]">{a.sub}</p>}
                </div>
              </button>
            ))}
          </Card>
        ))}
      </div>

      <BottomNav active="accounts" onNavigate={onNavigate} />
    </div>
  );
}

// ─── Screen: Ledger View ────────────────────────────────────────────────────

function LedgerScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  return (
    <div className="flex flex-col h-full bg-[#F2F3F7]">
      <DynamicIsland />
      <StatusBar />
      <div className="flex items-center justify-between px-5 pt-2 pb-3">
        <button
          onClick={() => onNavigate("dashboard")}
          className="w-8 h-8 rounded-full bg-white border border-[#E2E6F0] flex items-center justify-center"
          style={{ boxShadow: "0 1px 3px rgba(26,31,46,0.06)" }}
        >
          <ChevronLeft size={17} className="text-[#6B738E]" />
        </button>
        <h2 className="text-[15px] font-semibold text-[#1A1F2E]">Transaction</h2>
        <button
          className="w-8 h-8 rounded-full bg-white border border-[#E2E6F0] flex items-center justify-center"
          style={{ boxShadow: "0 1px 3px rgba(26,31,46,0.06)" }}
        >
          <Edit2 size={13} className="text-[#6B738E]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-6" style={{ scrollbarWidth: "none" }}>
        {/* Hero */}
        <Card className="p-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-3 text-[28px]">
            🍜
          </div>
          <h3 className="text-[16px] font-semibold text-[#1A1F2E]">Noodle House Lunch</h3>
          <p className="text-[11px] text-[#9EA6BE] mt-0.5">Jul 28, 2026 · 12:34 PM</p>
          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-100 font-medium">
              Food & Dining
            </span>
            <span className="text-[10px] bg-[#F0F1F6] text-[#9EA6BE] px-2 py-0.5 rounded-full font-medium">#lunch</span>
            <span className="text-[10px] bg-[#F0F1F6] text-[#9EA6BE] px-2 py-0.5 rounded-full font-medium">#team</span>
          </div>
          <p className="text-[30px] font-mono font-semibold text-[#DC2626] mt-3 leading-none">−$47.50</p>
        </Card>

        {/* Journal entry table */}
        <Card>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#F0FAF4] rounded-t-2xl border-b border-[#D1EDD9]">
            <Info size={11} className="text-[#1D6F42]" />
            <SectionLabel>Journal Entry · #TXN-20260728-0042</SectionLabel>
          </div>
          {/* Table header */}
          <div className="grid px-4 py-2 bg-[#F8F9FC] border-b border-[#F0F1F6]" style={{ gridTemplateColumns: "1fr 3.5rem 3.5rem" }}>
            <p className="text-[9px] font-semibold text-[#9EA6BE] uppercase tracking-widest">Account</p>
            <p className="text-[9px] font-semibold text-[#9EA6BE] uppercase tracking-widest text-right">Debit</p>
            <p className="text-[9px] font-semibold text-[#9EA6BE] uppercase tracking-widest text-right">Credit</p>
          </div>
          {/* Row 1 */}
          <div className="grid px-4 py-3 border-b border-[#F0F1F6]" style={{ gridTemplateColumns: "1fr 3.5rem 3.5rem" }}>
            <div>
              <p className="text-[12px] font-semibold text-[#1A1F2E]">Chase Checking</p>
              <p className="text-[9px] text-[#9EA6BE]">Asset account</p>
            </div>
            <p className="text-[12px] font-mono font-semibold text-[#DC2626] text-right self-center">$47.50</p>
            <p className="text-[12px] font-mono text-[#C0C7DA] text-right self-center">—</p>
          </div>
          {/* Row 2 */}
          <div className="grid px-4 py-3" style={{ gridTemplateColumns: "1fr 3.5rem 3.5rem" }}>
            <div>
              <p className="text-[12px] font-semibold text-[#1A1F2E]">Food & Dining</p>
              <p className="text-[9px] text-[#9EA6BE]">Expense account</p>
            </div>
            <p className="text-[12px] font-mono text-[#C0C7DA] text-right self-center">—</p>
            <p className="text-[12px] font-mono font-semibold text-[#DC2626] text-right self-center">$47.50</p>
          </div>
        </Card>

        {/* Metadata */}
        <Card>
          {[
            ["Original currency", "USD 47.50"],
            ["Exchange rate",     "1.0000 (no conversion)"],
            ["Memo",              "Lunch with team"],
            ["Sync status",       "✓ Synced · Jul 28 09:14"],
          ].map(([k, v], i, arr) => (
            <div
              key={k}
              className={`flex items-center justify-between px-4 py-3 ${i < arr.length - 1 ? "border-b border-[#F0F1F6]" : ""}`}
            >
              <p className="text-[12px] text-[#9EA6BE]">{k}</p>
              <p className="text-[12px] font-mono text-[#1A1F2E]">{v}</p>
            </div>
          ))}
        </Card>

        {/* Delete */}
        <button className="w-full rounded-2xl border border-[#FECACA] bg-[#FFF5F5] py-3.5 flex items-center justify-center gap-2 text-[#DC2626]">
          <Trash2 size={13} />
          <span className="text-[13px] font-semibold">Delete Transaction</span>
        </button>
      </div>
    </div>
  );
}

// ─── Screen: Currencies ─────────────────────────────────────────────────────

function CurrenciesScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [autoFetch, setAutoFetch] = useState(true);
  const rates = [
    { flag: "🇪🇺", code: "EUR", name: "Euro",              rate: "1.0825", stale: false },
    { flag: "🇬🇧", code: "GBP", name: "British Pound",     rate: "1.2730", stale: false },
    { flag: "🇯🇵", code: "JPY", name: "Japanese Yen",      rate: "0.0066", stale: true  },
    { flag: "🇨🇦", code: "CAD", name: "Canadian Dollar",   rate: "0.7320", stale: false },
    { flag: "🇸🇬", code: "SGD", name: "Singapore Dollar",  rate: "0.7581", stale: false },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F2F3F7]">
      <DynamicIsland />
      <StatusBar offline />
      <div className="flex items-center justify-between px-5 pt-2 pb-3">
        <button
          onClick={() => onNavigate("dashboard")}
          className="w-8 h-8 rounded-full bg-white border border-[#E2E6F0] flex items-center justify-center"
          style={{ boxShadow: "0 1px 3px rgba(26,31,46,0.06)" }}
        >
          <ChevronLeft size={17} className="text-[#6B738E]" />
        </button>
        <h2 className="text-[15px] font-semibold text-[#1A1F2E]">Currencies</h2>
        <button
          className="w-8 h-8 rounded-full bg-white border border-[#E2E6F0] flex items-center justify-center"
          style={{ boxShadow: "0 1px 3px rgba(26,31,46,0.06)" }}
        >
          <Plus size={16} className="text-[#6B738E]" />
        </button>
      </div>

      {/* Offline banner */}
      <div className="mx-4 mb-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] px-3.5 py-2.5 flex items-center gap-2.5">
        <WifiOff size={13} className="text-[#D97706] shrink-0" />
        <div>
          <p className="text-[11px] font-semibold text-[#92600A]">Offline · Using cached rates</p>
          <p className="text-[10px] text-[#B45309]">Last synced Jul 28, 2026 · 08:14 AM</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4" style={{ scrollbarWidth: "none" }}>

        {/* Base currency */}
        <Card className="p-4">
          <SectionLabel>Base Currency</SectionLabel>
          <button className="w-full flex items-center justify-between mt-3">
            <div className="flex items-center gap-3">
              <span className="text-[26px]">🇺🇸</span>
              <div>
                <p className="text-[15px] font-semibold text-[#1A1F2E]">USD</p>
                <p className="text-[11px] text-[#9EA6BE]">US Dollar</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-[#C0C7DA]" />
          </button>
        </Card>

        {/* Rates */}
        <Card>
          <div className="px-4 py-2.5 bg-[#F8F9FC] rounded-t-2xl border-b border-[#F0F1F6]">
            <SectionLabel>Rates → USD · 1 unit</SectionLabel>
          </div>
          {rates.map((r, i) => (
            <div
              key={r.code}
              className={`flex items-center justify-between px-4 py-3 ${i < rates.length - 1 ? "border-b border-[#F0F1F6]" : ""}`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[20px]">{r.flag}</span>
                <div>
                  <p className="text-[13px] font-semibold text-[#1A1F2E]">{r.code}</p>
                  <p className="text-[10px] text-[#9EA6BE]">{r.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.stale && <AlertTriangle size={11} className="text-[#D97706]" />}
                <p className={`text-[13px] font-mono font-semibold ${r.stale ? "text-[#D97706]" : "text-[#1A1F2E]"}`}>
                  {r.rate}
                </p>
                <button className="w-7 h-7 rounded-lg bg-[#F0F1F6] flex items-center justify-center">
                  <RefreshCw size={11} className="text-[#9EA6BE]" />
                </button>
              </div>
            </div>
          ))}
        </Card>

        {/* Toggle */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-[#1A1F2E]">Auto-fetch rates</p>
              <p className="text-[10px] text-[#9EA6BE]">Sync when connected · requires internet</p>
            </div>
            <button
              className={`w-11 h-6 rounded-full relative transition-colors ${autoFetch ? "bg-[#1D6F42]" : "bg-[#C0C7DA]"}`}
              onClick={() => setAutoFetch(f => !f)}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${autoFetch ? "left-6" : "left-1"}`}
              />
            </button>
          </div>
        </Card>

        {/* Manual override hint */}
        <div className="rounded-2xl border border-dashed border-[#C0C7DA] bg-white px-4 py-3.5">
          <SectionLabel>Manual Override</SectionLabel>
          <p className="text-[12px] text-[#6B738E] leading-relaxed mt-1.5">
            Tap any rate value to override manually — useful at exchange booths where you lock in a specific rate for that transaction.
          </p>
        </div>
      </div>

      <BottomNav active="currencies" onNavigate={onNavigate} />
    </div>
  );
}

// ─── Phone frame ────────────────────────────────────────────────────────────

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        width: 375,
        height: 780,
        borderRadius: 50,
        border: "8px solid #D4D8E8",
        background: "#F2F3F7",
        boxShadow:
          "0 0 0 1px rgba(180,185,210,0.5), 0 24px 80px rgba(26,31,46,0.18), inset 0 0 0 1px rgba(255,255,255,0.8)",
      }}
    >
      {/* Physical buttons */}
      <div className="absolute -right-[9px] top-24 w-[3px] h-16 rounded-r-full bg-[#C4C9DC]" />
      <div className="absolute -left-[9px] top-20 w-[3px] h-10 rounded-l-full bg-[#C4C9DC]" />
      <div className="absolute -left-[9px] top-36 w-[3px] h-10 rounded-l-full bg-[#C4C9DC]" />
      <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 44 }}>
        {children}
      </div>
    </div>
  );
}

// ─── Presentation shell ──────────────────────────────────────────────────────

function AnnotationCol({ title, items, accent }: { title: string; items: string[]; accent: "green" | "blue" }) {
  const colors = {
    green: { label: "text-[#1D6F42]", dot: "bg-[#16A34A]" },
    blue:  { label: "text-[#2563EB]", dot: "bg-[#3B82F6]" },
  }[accent];
  return (
    <div className="w-52 shrink-0">
      <p className={`text-[9px] font-bold uppercase tracking-widest mb-3 ${colors.label}`}>{title}</p>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} mt-[5px] shrink-0 opacity-70`} />
            <p className="text-[11px] text-[#6B738E] leading-relaxed">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowDiagram({ active, onNavigate }: { active: Screen; onNavigate: (s: Screen) => void }) {
  const flows: { from: Screen; to: Screen; label: string }[] = [
    { from: "dashboard", to: "add",        label: "Tap +" },
    { from: "dashboard", to: "ledger",     label: "Tap row" },
    { from: "dashboard", to: "budgets",    label: "Budget tab" },
    { from: "dashboard", to: "accounts",   label: "Accounts tab" },
    { from: "dashboard", to: "currencies", label: "Rates tab" },
    { from: "add",       to: "dashboard",  label: "Save / Cancel" },
  ];
  const screenLabel = (id: Screen) => SCREENS.find(s => s.id === id)?.label ?? id;
  const nodeCls = (id: Screen) =>
    `text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition-all ${
      active === id
        ? "border-[#A7D8B8] bg-[#E8F5EE] text-[#1D6F42]"
        : "border-[#E2E6F0] bg-white text-[#9EA6BE] hover:text-[#6B738E] hover:border-[#C0C7DA]"
    }`;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {flows.map((f, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <button onClick={() => onNavigate(f.from)} className={nodeCls(f.from)}>{screenLabel(f.from)}</button>
          <div className="flex items-center gap-0.5">
            <div className="h-px w-2 bg-[#C0C7DA]" />
            <span className="text-[8px] text-[#9EA6BE] whitespace-nowrap">{f.label}</span>
            <div className="h-px w-2 bg-[#C0C7DA]" />
            <span className="text-[8px] text-[#9EA6BE]">▶</span>
          </div>
          <button onClick={() => onNavigate(f.to)} className={nodeCls(f.to)}>{screenLabel(f.to)}</button>
        </div>
      ))}
    </div>
  );
}

// ─── Design pattern legend ────────────────────────────────────────────────────

function PatternLegend() {
  const tokens = [
    { swatch: "bg-[#F2F3F7] border border-[#E2E6F0]", label: "Surface",      sub: "#F2F3F7 · screen bg" },
    { swatch: "bg-white border border-[#E2E6F0]",      label: "Card",         sub: "#FFFFFF · elevated panel" },
    { swatch: "bg-[#F0F1F6]",                          label: "Field",        sub: "#F0F1F6 · input well" },
    { swatch: "bg-[#1D6F42]",                          label: "Brand Green",  sub: "#1D6F42 · primary action" },
    { swatch: "bg-[#16A34A]",                          label: "Positive",     sub: "#16A34A · income / gain" },
    { swatch: "bg-[#DC2626]",                          label: "Negative",     sub: "#DC2626 · expense / loss" },
    { swatch: "bg-[#D97706]",                          label: "Warning",      sub: "#D97706 · budget alert" },
    { swatch: "bg-[#1A1F2E]",                          label: "Ink",          sub: "#1A1F2E · primary text" },
    { swatch: "bg-[#9EA6BE]",                          label: "Faint",        sub: "#9EA6BE · labels / captions" },
    { swatch: "bg-[#E2E6F0]",                          label: "Hairline",     sub: "#E2E6F0 · dividers / borders" },
  ];
  return (
    <div
      className="rounded-2xl border border-[#E2E6F0] bg-white p-5 max-w-3xl mx-auto"
      style={{ boxShadow: "0 1px 4px rgba(26,31,46,0.06)" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#9EA6BE] mb-4">Design Pattern · Color Tokens</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {tokens.map(t => (
          <div key={t.label} className="flex items-center gap-2.5">
            <div className={`w-6 h-6 rounded-lg shrink-0 ${t.swatch}`} />
            <div>
              <p className="text-[11px] font-semibold text-[#1A1F2E]">{t.label}</p>
              <p className="text-[9px] text-[#9EA6BE] font-mono">{t.sub}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-[#F0F1F6] grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#9EA6BE] mb-2">Typography</p>
          <p className="text-[11px] text-[#6B738E]"><span className="font-semibold text-[#1A1F2E]">Outfit</span> — UI labels, names, headings</p>
          <p className="text-[11px] text-[#6B738E] mt-1"><span className="font-semibold text-[#1A1F2E] font-mono">JetBrains Mono</span> — all amounts & rates</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#9EA6BE] mb-2">Elevation</p>
          <p className="text-[11px] text-[#6B738E]"><span className="font-semibold text-[#1A1F2E]">Screen</span> — #F2F3F7 base</p>
          <p className="text-[11px] text-[#6B738E] mt-1"><span className="font-semibold text-[#1A1F2E]">Card</span> — white + 1px border + 1px shadow</p>
        </div>
      </div>
    </div>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const notes = UX_NOTES[screen];
  const active = SCREENS.find(s => s.id === screen)!;

  const renderScreen = () => {
    switch (screen) {
      case "dashboard":  return <DashboardScreen  onNavigate={setScreen} />;
      case "add":        return <AddScreen         onNavigate={setScreen} />;
      case "budgets":    return <BudgetsScreen     onNavigate={setScreen} />;
      case "accounts":   return <AccountsScreen    onNavigate={setScreen} />;
      case "ledger":     return <LedgerScreen      onNavigate={setScreen} />;
      case "currencies": return <CurrenciesScreen  onNavigate={setScreen} />;
    }
  };

  return (
    <div
      className="min-h-screen py-10 px-6"
      style={{ background: "linear-gradient(160deg, #EEF0F8 0%, #E8EAF2 100%)", fontFamily: "Outfit, sans-serif" }}
    >
      {/* Header */}
      <div className="text-center mb-7 max-w-xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-[#A7D8B8] bg-[#E8F5EE] text-[#1D6F42] uppercase tracking-widest">
            Prototype Wireframe
          </span>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-[#E2E6F0] bg-white text-[#9EA6BE] uppercase tracking-widest">
            iOS · Android
          </span>
        </div>
        <h1 className="text-[22px] font-bold text-[#1A1F2E]">Personal Expense & Budget Tracker</h1>
        <p className="text-[13px] text-[#9EA6BE] mt-1">Double-entry ledger · Multi-currency · Offline-first mobile</p>
      </div>

      {/* Screen selector */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap mb-7">
        {SCREENS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setScreen(s.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
              screen === s.id
                ? "bg-[#E8F5EE] border-[#A7D8B8] text-[#1D6F42]"
                : "bg-white border-[#E2E6F0] text-[#9EA6BE] hover:text-[#6B738E] hover:border-[#C0C7DA]"
            }`}
          >
            <span className="text-[9px] font-mono text-[#C0C7DA]">{i + 1}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Phone + annotations */}
      <div className="flex items-start justify-center gap-8 max-w-5xl mx-auto">
        <div className="hidden lg:block pt-8">
          <AnnotationCol title="User Actions" items={notes.actions} accent="green" />
        </div>

        <div className="flex flex-col items-center">
          <PhoneFrame>{renderScreen()}</PhoneFrame>
          <div className="mt-4 text-center">
            <p className="text-[13px] font-semibold text-[#1A1F2E]">{active.label}</p>
            <p className="text-[11px] text-[#9EA6BE] mt-0.5 max-w-xs">{active.desc}</p>
          </div>
        </div>

        <div className="hidden lg:block pt-8">
          <AnnotationCol title="UX Decisions" items={notes.decisions} accent="blue" />
        </div>
      </div>

      {/* Flow diagram */}
      <div className="max-w-3xl mx-auto mt-8">
        <p className="text-center text-[9px] text-[#9EA6BE] uppercase tracking-widest font-bold mb-3">Navigation Flow</p>
        <FlowDiagram active={screen} onNavigate={setScreen} />
      </div>

      {/* Design pattern legend */}
      <div className="mt-8 max-w-3xl mx-auto">
        <p className="text-center text-[9px] text-[#9EA6BE] uppercase tracking-widest font-bold mb-3">Design System</p>
        <PatternLegend />
      </div>

      {/* Feature strip */}
      <div className="flex items-center justify-center gap-5 flex-wrap mt-8">
        {[
          { icon: "⚡", t: "Offline-first · SQLite" },
          { icon: "⚖️", t: "Double-entry ledger" },
          { icon: "🌍", t: "Multi-currency · 150+" },
          { icon: "🔄", t: "Background sync" },
        ].map(b => (
          <div key={b.t} className="flex items-center gap-1.5 text-[11px] text-[#9EA6BE] font-medium">
            <span>{b.icon}</span>{b.t}
          </div>
        ))}
      </div>
    </div>
  );
}
