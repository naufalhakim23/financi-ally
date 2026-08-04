import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

import { currencyError } from "@financially/domain/validate";

import { Field } from "@/components/field";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HTTPError, type AccountType } from "@/lib/api";
import { useCreateAccount } from "@/lib/queries";

// Lives here rather than inside the pockets screen because the setup checklist
// opens the same dialog with the kind already chosen — the whole point of the
// checklist is that its actions land you on the exact thing that is missing.

const TYPES: { value: AccountType; label: string }[] = [
  { value: "asset", label: "Pocket (cash, bank, e-wallet)" },
  { value: "expense", label: "Category (what you spend on)" },
  { value: "income", label: "Income source" },
  { value: "liability", label: "Card or loan" },
];

export function NewAccountDialog({
  baseCurrency,
  defaultType = "asset",
  trigger,
}: {
  baseCurrency: string;
  defaultType?: AccountType;
  trigger?: ReactNode;
}) {
  const create = useCreateAccount();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>(defaultType);
  const [currency, setCurrency] = useState(baseCurrency);
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const nameErr = touched && !name.trim() ? "Give it a name" : null;
  const currencyErr = touched ? currencyError(currency, { required: true }) : null;

  function onOpenChange(next: boolean) {
    setOpen(next);
    // Reopening from a different checklist row must offer that row's kind, not
    // whatever was picked last time.
    if (next) setType(defaultType);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setFailure(null);
    if (!name.trim() || currencyError(currency, { required: true })) return;

    try {
      await create.mutateAsync({
        type,
        name: name.trim(),
        currency: currency.trim().toUpperCase(),
      });
      setOpen(false);
      setName("");
      setTouched(false);
    } catch (err) {
      setFailure(
        err instanceof HTTPError && err.status === 409
          ? "You already have one of these with that name."
          : "Couldn't create it. Check your connection and try again.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" />
            New account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {failure ? <ErrorState message={failure} /> : null}

          <div className="space-y-1.5">
            <Label className="text-label text-ink">Kind</Label>
            <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Field
            label="Name"
            value={name}
            error={nameErr}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label="Currency"
            value={currency}
            error={currencyErr}
            maxLength={3}
            hint="the currency this account holds — it can't change later"
            onChange={(e) => setCurrency(e.target.value)}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
