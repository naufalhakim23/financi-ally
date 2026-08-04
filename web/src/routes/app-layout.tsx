import {
  ArrowLeftRight,
  BookOpen,
  LayoutDashboard,
  Menu,
  PieChart,
  Repeat,
  Settings,
  Target,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router";

import { BookSwitcher } from "@/components/book-switcher";
import { OfflineBanner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { useAccounts } from "@/lib/queries";
import { setupSkipped } from "@/lib/setup";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";
import { useWording } from "@/lib/wording";

// Desktop-first shell: a persistent sidebar beside a fluid content column,
// collapsing to a drawer below `md`. The phone shape the mobile app uses is
// deliberately not reproduced here — a browser window is not a phone, and
// stretching a bottom tab bar across 1440px wastes the space that makes the
// desktop version worth having.

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };
type NavGroup = { heading: string; items: NavItem[] };

// Grouped, not eight flat equals: a new user needs Pockets before they can run
// a single report, and a flat list said those were the same kind of thing.
// Group headings are structure, not vocabulary, so they stay out of the wording
// map while the item labels keep going through `t()`.
function useNavGroups(): NavGroup[] {
  const { t } = useWording();
  return [
    {
      heading: "Money",
      items: [
        { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
        { to: "/app/history", label: t("history"), icon: ArrowLeftRight },
      ],
    },
    {
      heading: "Plan",
      items: [
        { to: "/app/pockets", label: t("buckets"), icon: Wallet },
        { to: "/app/budgets", label: "Budgets", icon: Target },
        { to: "/app/recurring", label: "Recurring", icon: Repeat },
      ],
    },
    {
      heading: "Insight",
      items: [{ to: "/app/reports", label: "Reports", icon: PieChart }],
    },
  ];
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "text-body flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors",
    "focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none",
    isActive
      ? "bg-surface-container-high text-ink font-semibold"
      : "text-dim hover:bg-surface-container hover:text-ink",
  );

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const groups = useNavGroups();
  return (
    <nav className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.heading} className="flex flex-col gap-0.5">
          <span className="text-caption text-faint px-3 pb-1 font-semibold tracking-wide uppercase">
            {group.heading}
          </span>
          {group.items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onNavigate} className={linkClass}>
              <Icon className="size-4 shrink-0" strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-3">
      <div className="px-3 pt-2">
        <span className="text-headline text-ink font-semibold">Financi-Ally</span>
      </div>
      <NavLinks onNavigate={onNavigate} />
      {/* Books and Settings are about the account, not about money — they sit
          below the divider rather than in a group of their own. */}
      <div className="border-outline mt-auto flex flex-col gap-0.5 border-t pt-3">
        <NavLink to="/app/books" onClick={onNavigate} className={linkClass}>
          <BookOpen className="size-4 shrink-0" strokeWidth={1.75} />
          Books
        </NavLink>
        <NavLink to="/app/settings" onClick={onNavigate} className={linkClass}>
          <Settings className="size-4 shrink-0" strokeWidth={1.75} />
          Settings
        </NavLink>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const online = useOnline();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Never decide before the boot refresh settles, or a reload bounces an
  // authenticated user to the login screen.
  if (loading) {
    return (
      <div className="bg-background flex min-h-dvh items-center justify-center">
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  if (!user) {
    // Search and hash included, or /app/history?month=2026-03 comes back from
    // the sign-in screen as a bare /app/history.
    const from = location.pathname + location.search + location.hash;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  // The wizard renders under this layout for the auth gate, but with no chrome.
  // A sidebar beside it is a trap: the empty-ledger guard below re-fires on
  // every nav click and bounces the user back here with no explanation, and
  // only the wizard's own Skip escapes.
  if (location.pathname === "/app/setup") {
    return (
      <div className="bg-background min-h-dvh px-4 py-6 md:px-6">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="bg-background min-h-dvh">
      <EmptyLedgerRedirect />
      {!online ? <OfflineBanner /> : null}

      <div className="mx-auto flex w-full max-w-[1600px]">
        <aside className="border-outline bg-surface sticky top-0 hidden h-dvh w-56 shrink-0 border-r md:block">
          <SidebarContent />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-outline bg-surface/85 sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-3 backdrop-blur">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SidebarContent onNavigate={() => setDrawerOpen(false)} />
              </SheetContent>
            </Sheet>

            <BookSwitcher />
          </header>

          <main className="min-w-0 flex-1 px-4 py-6 md:px-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

/**
 * Send a ledger with no accounts to the wizard.
 *
 * Its own component so the query only runs once past the auth checks above —
 * an unauthenticated render would fire a request that can only 401.
 *
 * Only a *successful* empty response counts. `useAccounts()` falls back to an
 * empty array, so both the loading window and a failed fetch look identical to
 * a brand-new ledger — and an established user who opens the app offline would
 * be dumped into onboarding by a request that never arrived.
 */
function EmptyLedgerRedirect() {
  const { isSuccess, accounts } = useAccounts();

  if (setupSkipped()) return null;
  if (!isSuccess || accounts.length > 0) return null;
  return <Navigate to="/app/setup" replace />;
}
