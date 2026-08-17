import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import type { Location } from "react-router";

import { LoadingRows } from "@/components/states";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { onLedgerChange } from "@/lib/ledger-store";
import { queryClient } from "@/lib/query";
import { ThemeProvider } from "@/lib/theme";
import { WordingProvider } from "@/lib/wording";
import { AppLayout } from "@/routes/app-layout";
import { BooksRoute } from "@/routes/books";
import { BudgetsRoute } from "@/routes/budgets";
import { DashboardRoute } from "@/routes/dashboard";
import { EntryDetailRoute } from "@/routes/entry-detail";
import { EntryNewRoute } from "@/routes/entry-new";
import { ForgotPasswordRoute } from "@/routes/forgot-password";
import { HistoryRoute } from "@/routes/history";
import { LoginRoute } from "@/routes/login";
import { LandingRoute } from "@/routes/landing";
import { PocketsRoute } from "@/routes/pockets";
import { RecurringRoute } from "@/routes/recurring";
import { RegisterRoute } from "@/routes/register";
import { ResetPasswordRoute } from "@/routes/reset-password";
import { SettingsRoute } from "@/routes/settings";
import { SetupRoute } from "@/routes/setup";

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

// Reports is the only screen that pulls in the charting library, and it is the
// screen people open least. Splitting it keeps the charts out of the bundle
// every other screen has to download first.
const ReportsRoute = lazy(() =>
  import("@/routes/reports").then((m) => ({ default: m.ReportsRoute })),
);

/**
 * Routes, with the entry dialogs layered over whatever the user was reading.
 *
 * A link into an entry carries `state.background`, so the first <Routes> keeps
 * rendering the list underneath while the second renders the dialog on top, so
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
        <Route path="/" element={<LandingRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/register" element={<RegisterRoute />} />
        <Route path="/forgot-password" element={<ForgotPasswordRoute />} />
        <Route path="/reset-password" element={<ResetPasswordRoute />} />

        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardRoute />} />
          <Route path="history" element={<HistoryRoute />} />
          <Route path="pockets" element={<PocketsRoute />} />
          <Route path="budgets" element={<BudgetsRoute />} />
          <Route
            path="reports"
            element={
              <Suspense fallback={<LoadingRows rows={5} />}>
                <ReportsRoute />
              </Suspense>
            }
          />
          <Route path="recurring" element={<RecurringRoute />} />
          <Route path="books" element={<BooksRoute />} />
          <Route path="settings" element={<SettingsRoute />} />
          <Route path="setup" element={<SetupRoute />} />
          {/* Reached only without a background, a cold load of an entry URL. */}
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
