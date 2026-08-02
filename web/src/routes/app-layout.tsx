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
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";
import { useWording } from "@/lib/wording";

// Desktop-first shell: a persistent sidebar beside a fluid content column,
// collapsing to a drawer below `md`. The phone shape the mobile app uses is
// deliberately not reproduced here — a browser window is not a phone, and
// stretching a bottom tab bar across 1440px wastes the space that makes the
// desktop version worth having.

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };

function useNavItems(): NavItem[] {
  const { t } = useWording();
  return [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/app/history", label: t("history"), icon: ArrowLeftRight },
    { to: "/app/pockets", label: t("buckets"), icon: Wallet },
    { to: "/app/budgets", label: "Budgets", icon: Target },
    { to: "/app/reports", label: "Reports", icon: PieChart },
    { to: "/app/recurring", label: "Recurring", icon: Repeat },
    { to: "/app/books", label: "Books", icon: BookOpen },
  ];
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const items = useNavItems();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "text-body flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors",
              "focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none",
              isActive
                ? "bg-surface-container-high text-ink font-semibold"
                : "text-dim hover:bg-surface-container hover:text-ink",
            )
          }
        >
          <Icon className="size-4 shrink-0" strokeWidth={1.75} />
          {label}
        </NavLink>
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
      <div className="mt-auto">
        <NavLink
          to="/app/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "text-body flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors",
              isActive
                ? "bg-surface-container-high text-ink font-semibold"
                : "text-dim hover:bg-surface-container hover:text-ink",
            )
          }
        >
          <Settings className="size-4" strokeWidth={1.75} />
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
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="bg-background min-h-dvh">
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
