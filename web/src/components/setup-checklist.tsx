import { Check, X } from "lucide-react";

import { AddEntryButton } from "@/components/add-entry-button";
import { NewAccountDialog } from "@/components/new-account-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AccountType } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSetupState, type SetupItem } from "@/lib/setup";
import { cn } from "@/lib/utils";

// The safety net under a skippable wizard. Every row is derived from the
// ledger, so it ticks itself the moment the thing exists — whether it was
// created here, in the wizard, or on the phone.

const KIND_FOR: Record<Exclude<SetupItem["key"], "entry">, AccountType> = {
  pocket: "asset",
  category: "expense",
  income: "income",
};

export function SetupChecklist() {
  const { user } = useAuth();
  const { items, done, complete, dismissed, dismiss, loading } = useSetupState();

  // A finished ledger needs no card, and an empty array during the first fetch
  // would otherwise flash "0 of 4" at someone who set up months ago.
  if (loading || complete || dismissed) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-body-lg text-ink font-semibold">Finish setting up</h2>
          <Button variant="ghost" size="icon" aria-label="Dismiss setup checklist" onClick={dismiss}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={items.length}
            className="bg-surface-container-high h-2 flex-1 overflow-hidden rounded-full"
          >
            <div
              className="bg-ink h-full rounded-full transition-[width]"
              style={{ width: `${(done / items.length) * 100}%` }}
            />
          </div>
          <span className="text-caption text-faint tabular shrink-0">
            {done} of {items.length}
          </span>
        </div>

        <ul className="divide-outline-variant divide-y">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-3 py-2">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                  item.done ? "border-success bg-success text-on-success" : "border-outline",
                )}
              >
                {item.done ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "text-body block truncate",
                    item.done ? "text-dim line-through" : "text-ink",
                  )}
                >
                  {item.label}
                </span>
                <span className="text-caption text-faint block truncate">{item.hint}</span>
              </span>
              {item.done ? null : item.key === "entry" ? (
                <AddEntryButton size="sm" />
              ) : (
                <NewAccountDialog
                  baseCurrency={user?.base_currency ?? "IDR"}
                  defaultType={KIND_FOR[item.key]}
                  trigger={
                    <Button size="sm" variant="outline">
                      Add
                    </Button>
                  }
                />
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
