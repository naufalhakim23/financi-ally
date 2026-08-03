import { ArrowRight, BookOpen, Globe2, PieChart, Repeat, Target, Wallet } from "lucide-react";
import { Link, Navigate } from "react-router";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

// The public front door. Deliberately plain: the product is a ledger, and a
// marketing page that oversells calm-and-clarity while the app itself is a
// table of numbers sets up a disappointment on the first click.

const FEATURES = [
  {
    icon: Wallet,
    title: "Pockets, not spreadsheets",
    body: "Cash, bank, e-wallets and cards in one place, each in its own currency, with a real double-entry ledger underneath.",
  },
  {
    icon: Target,
    title: "A plan you can keep",
    body: "Set a monthly target per category and see spent-vs-target as the month runs, not after it ends.",
  },
  {
    icon: Globe2,
    title: "Multi-currency, honestly",
    body: "Foreign balances convert at daily rates and say so. When no rate exists you see a dash, never a made-up zero.",
  },
  {
    icon: Repeat,
    title: "Rent posts itself",
    body: "Rules for the entries that repeat — rent, subscriptions, salary — materialized on schedule by the server.",
  },
  {
    icon: PieChart,
    title: "Reports that add up",
    body: "Net worth, cash flow and category breakdowns computed on the server, so every client shows the same figure.",
  },
  {
    icon: BookOpen,
    title: "Shared books",
    body: "Keep a household book beside your personal one. Invite by code, switch in a click, never mix the two.",
  },
];

export function LandingRoute() {
  const { user, loading } = useAuth();

  // Someone with a live session came here by typing the bare domain or
  // following an old bookmark, send them to their book rather than pitching a
  // product they already use. Never decide before the boot refresh settles.
  if (loading) return <div className="bg-background min-h-dvh" />;
  if (user) return <Navigate to="/app" replace />;

  return (
    <div className="bg-background min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="text-headline text-ink font-semibold">Financi-Ally</span>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24">
        <section className="py-16 md:py-24">
          <h1 className="text-display-xl text-ink max-w-2xl font-bold text-balance">
            Know where your money actually went.
          </h1>
          <p className="text-body-lg text-dim mt-5 max-w-xl">
            A personal ledger with double-entry underneath and plain words on top. Track pockets and
            categories, set a monthly plan, share a book with the people you split life with.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link to="/register">
                Create an account
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">I already have one</Link>
            </Button>
          </div>
          <p className="text-caption text-faint mt-4">
            Free while it&rsquo;s in the making. Your data stays yours.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="bg-surface border-outline shadow-card space-y-2 rounded-xl border p-5"
            >
              <Icon className="text-dim size-5" strokeWidth={1.75} />
              <h2 className="text-body-lg text-ink font-semibold">{title}</h2>
              <p className="text-body text-dim">{body}</p>
            </div>
          ))}
        </section>

        <section className="border-outline mt-16 rounded-xl border border-dashed p-6 text-center">
          <p className="text-body text-dim">
            Financi-Ally runs in the browser and on your phone, against the same book.
          </p>
          <Button asChild className="mt-4">
            <Link to="/register">Start your book</Link>
          </Button>
        </section>
      </main>

      <footer className="border-outline border-t">
        <div className="text-caption text-faint mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-6">
          <span>Financi-Ally</span>
          <span>Built as a personal finance ledger, not a bank.</span>
        </div>
      </footer>
    </div>
  );
}
