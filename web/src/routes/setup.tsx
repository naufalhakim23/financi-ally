import { Check } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { STARTER_STEPS, defaultSelection } from "@financially/domain/starter";

import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { markSetupSkipped, useSeedAccounts } from "@/lib/setup";
import { cn } from "@/lib/utils";
import { useWording } from "@/lib/wording";

// First-run setup. Three steps, every one skippable: a wizard nobody can escape
// is a wall in front of someone who only wanted to look around. The dashboard
// checklist is what catches whoever bails.
//
// The currency step the plan sketched is gone — base currency is fixed at
// registration and has no update endpoint, so the step could only have shown a
// value it could not change.

export function SetupRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useWording();
  const seed = useSeedAccounts();
  const currency = user?.base_currency ?? "IDR";

  const [step, setStep] = useState(0);
  const [selection, setSelection] = useState<Set<string>>(defaultSelection);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Set when the commit created some accounts but not all: the ledger is usable
  // and retrying would duplicate what landed, so the only sane exit is forward.
  const [partial, setPartial] = useState(false);

  const current = STARTER_STEPS[step];
  const last = step === STARTER_STEPS.length - 1;

  function toggle(name: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  }

  function skip() {
    markSetupSkipped();
    navigate("/app", { replace: true });
  }

  async function finish() {
    setFailure(null);
    // Nothing picked is a skip in disguise; there is no empty volley to send.
    if (selection.size === 0) return skip();

    setBusy(true);
    const { created, attempted, error } = await seed(selection, currency);
    setBusy(false);

    if (!error) return navigate("/app", { replace: true });
    if (created === 0) {
      setFailure("Couldn't create your accounts. Check your connection and try again.");
      return;
    }
    // Partial success still leaves a usable ledger, and the checklist is the
    // recovery path — so say what happened and let them in rather than
    // stranding them on a wizard that already did half the work.
    setPartial(true);
    setFailure(`Created ${created} of ${attempted}. You can add the rest from ${t("buckets")}.`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {/* Dots are decorative; the count next to them is the only step
              position a screen reader has, so aria-hidden stops at the dots. */}
          <span className="flex items-center gap-1.5" aria-hidden>
            {STARTER_STEPS.map((s, i) => (
              <span
                key={s.key}
                className={cn(
                  "size-2 rounded-full",
                  i <= step ? "bg-ink" : "bg-outline-variant",
                )}
              />
            ))}
          </span>
          <span className="text-caption text-faint ml-2">
            Step {step + 1} of {STARTER_STEPS.length}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={skip}>
          Skip
        </Button>
      </div>

      <div className="space-y-1">
        <h1 className="text-title text-ink font-bold">{current.title}</h1>
        <p className="text-body text-dim">{current.hint}</p>
      </div>

      {failure ? <ErrorState message={failure} /> : null}

      <Card>
        <CardContent className="flex flex-wrap gap-2 p-4">
          {current.items.map((item) => {
            const on = selection.has(item.name);
            return (
              <button
                key={item.name}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(item.name)}
                className={cn(
                  "text-body flex items-center gap-2 rounded-full border px-4 py-2 transition-colors",
                  "focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none",
                  on
                    ? "border-ink bg-surface-container-high text-ink font-semibold"
                    : "border-outline text-dim hover:bg-surface-container",
                )}
              >
                <Check className={cn("size-4 shrink-0", !on && "opacity-0")} strokeWidth={2.5} />
                {item.name}
                {item.type === "liability" ? (
                  <span className="text-caption text-faint">you owe this</span>
                ) : null}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-caption text-faint">All created in {currency}, your base currency.</p>

      <div className="flex items-center justify-end gap-2">
        {/* Back disappears once the commit half-landed: the only remaining
            action is forward, and stepping back would leave a "Continue" that
            no longer continues anything. */}
        {step > 0 && !partial ? (
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={busy}>
            Back
          </Button>
        ) : null}
        {partial ? (
          <Button onClick={() => navigate("/app", { replace: true })}>Continue</Button>
        ) : last ? (
          <Button onClick={finish} disabled={busy}>
            {busy ? "Creating…" : "Finish"}
          </Button>
        ) : (
          <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
        )}
      </div>
    </div>
  );
}
