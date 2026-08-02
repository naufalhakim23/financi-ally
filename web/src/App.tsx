import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import type { Location } from "react-router";

import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { onLedgerChange } from "@/lib/ledger-store";
import { queryClient } from "@/lib/query";
import { ThemeProvider } from "@/lib/theme";
import { WordingProvider } from "@/lib/wording";
import { AppLayout } from "@/routes/app-layout";
import { DashboardRoute } from "@/routes/dashboard";
import { EntryDetailRoute } from "@/routes/entry-detail";
import { EntryNewRoute } from "@/routes/entry-new";
import { ForgotPasswordRoute } from "@/routes/forgot-password";
import { HistoryRoute } from "@/routes/history";
import { LoginRoute } from "@/routes/login";
import { PocketsRoute } from "@/routes/pockets";
import { RegisterRoute } from "@/routes/register";
import { ResetPasswordRoute } from "@/routes/reset-password";
import { SettingsRoute } from "@/routes/settings";

/**
 * Drop every cached figure when the active book changes.
 *
 * The switcher already clears the cache, but the store is also written from
 * elsewhere (sign-out, and later a 403 falling back to the personal book), and
 * showing one book's balances under another book's name is the worst bug this
 * app could ship. One subscription makes that impossible by construction.
 */
function useCacheResetOnBookChange() {
  useEffect(() => onLedgerChange(() => queryClient.clear()), []);
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-title text-ink font-bold">{title}</h1>
      <p className="text-body text-dim">Coming in the next step.</p>
    </div>
  );
}

/**
 * Routes, with the entry dialogs layered over whatever the user was reading.
 *
 * A link into an entry carries `state.background`, so the first <Routes> keeps
 * rendering the list underneath while the second renders the dialog on top —
 * recording a coffee doesn't lose your place in the ledger. Opening the same URL
 * cold (a shared link, a reload) has no background, so it falls through to the
 * bottom <Routes> and the dialog stands on its own. Either way the URL is real,
 * so back and forward behave.
 */
function AppRoutes() {
  const location = useLocation();
  const background = (location.state as { background?: Location } | null)?.background;

  return (
    <>
      <Routes location={background ?? location}>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/register" element={<RegisterRoute />} />
        <Route path="/forgot-password" element={<ForgotPasswordRoute />} />
        <Route path="/reset-password" element={<ResetPasswordRoute />} />

        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardRoute />} />
          <Route path="history" element={<HistoryRoute />} />
          <Route path="pockets" element={<PocketsRoute />} />
          <Route path="budgets" element={<Placeholder title="Budgets" />} />
          <Route path="reports" element={<Placeholder title="Reports" />} />
          <Route path="recurring" element={<Placeholder title="Recurring" />} />
          <Route path="books" element={<Placeholder title="Books" />} />
          <Route path="settings" element={<SettingsRoute />} />
          {/* Reached only without a background — a cold load of an entry URL. */}
          <Route path="entry/new" element={<EntryNewRoute />} />
          <Route path="entry/:id" element={<EntryDetailRoute />} />
        </Route>

        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>

      {background ? (
        <Routes>
          <Route path="/app/entry/new" element={<EntryNewRoute />} />
          <Route path="/app/entry/:id" element={<EntryDetailRoute />} />
        </Routes>
      ) : null}
    </>
  );
}

export default function App() {
  useCacheResetOnBookChange();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <WordingProvider>
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
              <Toaster />
            </AuthProvider>
          </BrowserRouter>
        </WordingProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
