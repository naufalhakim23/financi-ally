import { BookOpen, Check, Copy, LogOut, Plus, UserMinus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { currencyError } from "@financially/domain/validate";

import { Field } from "@/components/field";
import { ErrorState, LoadingRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { setActiveLedger, useActiveLedger } from "@/lib/ledger-store";
import {
  useCreateInvite,
  useCreateLedger,
  useJoinLedger,
  useLedgerMembers,
  useLedgers,
  useQueryClient,
  useRemoveMember,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

// Books: the personal ledger plus any household the user shares.
//
// On the web, switching is genuinely cheap, nothing is stored locally, so it
// is a header change plus a cache clear. (The same action on mobile wipes and
// re-pulls a local database, which is why that screen confirms first and this
// one doesn't.)

export function BooksRoute() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ledgersQ = useLedgers();
  const active = useActiveLedger();

  const books = ledgersQ.data ?? [];
  const current =
    books.find((b) => b.ledger.id === active) ?? books.find((b) => b.ledger.kind === "personal");
  const shared = current?.ledger.kind === "household" ? current : null;

  const membersQ = useLedgerMembers(shared?.ledger.id ?? null);
  const invite = useCreateInvite();
  const removeMember = useRemoveMember();

  const [inviteCode, setInviteCode] = useState<{ code: string; expires: string } | null>(null);
  const [pendingLeave, setPendingLeave] = useState(false);

  function switchTo(id: string | null) {
    if (id === active) return;
    setActiveLedger(id);
    // Not optional. Every money key is namespaced by book, but clearing removes
    // any chance of the previous book's figures surviving on screen for a frame.
    queryClient.clear();
    setInviteCode(null);
  }

  async function makeInvite() {
    if (!shared) return;
    try {
      const inv = await invite.mutateAsync(shared.ledger.id);
      setInviteCode({ code: inv.code, expires: inv.expires_at });
    } catch {
      toast.error("Couldn't create an invite code.");
    }
  }

  async function leave() {
    if (!shared || !user) return;
    const leaving = shared.ledger.id;
    try {
      // Move out before dropping the membership. The other order leaves the app
      // standing in a book the server now refuses.
      switchTo(null);
      await removeMember.mutateAsync({ id: leaving, userId: user.id });
      setPendingLeave(false);
      toast.success("You left the book and are back in your personal one");
    } catch {
      // Still a member, so put the user back where they were. Leaving them in
      // the personal book after a failed leave reads as success.
      switchTo(leaving);
      setPendingLeave(false);
      toast.error("Couldn't leave the book.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title text-ink font-bold">Books</h1>
        <div className="flex gap-2">
          <JoinDialog />
          <CreateDialog baseCurrency={user?.base_currency ?? "IDR"} />
        </div>
      </div>

      {ledgersQ.error ? (
        <ErrorState message="Couldn't load your books." onRetry={() => void ledgersQ.refetch()} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-label text-faint font-semibold uppercase">
            Currently in
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-amount-lg text-ink font-mono font-bold">
            {current?.ledger.name ?? "Personal"}
          </p>
          <p className="text-caption text-faint">
            {shared
              ? "shared — everything you add here is visible to the other members"
              : "private to you"}
          </p>
        </CardContent>
      </Card>

      {ledgersQ.isPending ? (
        <Card>
          <CardContent>
            <LoadingRows rows={2} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-outline-variant divide-y">
              {books.map(({ ledger, role }) => {
                const isActive = ledger.id === active || (ledger.kind === "personal" && !active);
                return (
                  <li key={ledger.id} className="flex items-center gap-3 px-4 py-3">
                    <BookOpen className="text-faint size-4 shrink-0" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1">
                      <span className="text-body text-ink block truncate font-medium">
                        {ledger.name}
                      </span>
                      <span className="text-caption text-faint">
                        {ledger.kind === "personal" ? "personal" : "shared"} · {role} ·{" "}
                        {ledger.base_currency}
                      </span>
                    </span>
                    {isActive ? (
                      <span className="text-label text-success-strong flex items-center gap-1">
                        <Check className="size-3.5" />
                        Active
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => switchTo(ledger.kind === "personal" ? null : ledger.id)}
                      >
                        Switch
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {shared ? (
        <Card>
          {/* `flex` is load-bearing: CardHeader is a grid by default, so
              flex-row alone leaves the action stacked under the title. */}
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-headline text-ink flex items-center gap-2 font-semibold">
              <Users className="size-4" strokeWidth={1.75} />
              Members
            </CardTitle>
            {shared.role === "owner" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={invite.isPending}
                onClick={() => void makeInvite()}
              >
                {invite.isPending ? "Creating…" : "Invite someone"}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {inviteCode ? <InviteCode code={inviteCode.code} expires={inviteCode.expires} /> : null}

            {membersQ.isPending ? (
              <LoadingRows rows={2} />
            ) : (
              <ul className="divide-outline-variant divide-y">
                {(membersQ.data ?? []).map((m) => (
                  <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="text-body text-ink block truncate">{m.email}</span>
                      <span className="text-caption text-faint">{m.role}</span>
                    </span>
                    {/* Owners remove others; nobody removes themselves here.
                        Leaving is its own action below, because it also has to
                        move the user out of the book first. */}
                    {shared.role === "owner" && m.user_id !== user?.id ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${m.email}`}
                        disabled={removeMember.isPending}
                        onClick={() =>
                          removeMember.mutate(
                            { id: shared.ledger.id, userId: m.user_id },
                            { onError: () => toast.error(`Couldn't remove ${m.email}.`) },
                          )
                        }
                      >
                        <UserMinus className="size-4" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setPendingLeave(true)}
            >
              <LogOut className="size-3.5" />
              Leave this book
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={pendingLeave} onOpenChange={setPendingLeave}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave {shared?.ledger.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-body text-dim">
            You stop seeing this book&rsquo;s entries and go back to your personal one. The entries
            themselves stay with the book — you can be invited again.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingLeave(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={removeMember.isPending}
              onClick={() => void leave()}
            >
              {removeMember.isPending ? "Leaving…" : "Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InviteCode({ code, expires }: { code: string; expires: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused (insecure context, permission). The
      // code is on screen either way, so this is not worth an error.
      toast.message("Copy it manually — clipboard access was refused.");
    }
  }

  return (
    <div className="border-info-edge bg-info-wash space-y-2 rounded-lg border p-4">
      <p className="text-caption text-faint">Share this code — it expires {formatDay(expires)}</p>
      <div className="flex items-center gap-2">
        <code className="text-amount-lg text-ink flex-1 font-mono font-bold tracking-widest">
          {code}
        </code>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void copy()}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function CreateDialog({ baseCurrency }: { baseCurrency: string }) {
  const create = useCreateLedger();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Give the book a name");
    const currencyErr = currencyError(currency, { required: true });
    if (currencyErr) return setError(currencyErr);

    try {
      await create.mutateAsync({
        name: name.trim(),
        baseCurrency: currency.trim().toUpperCase(),
      });
      setOpen(false);
      setName("");
      toast.success("Book created. Switch to it to start adding entries.");
    } catch {
      setError("Couldn't create the book. Check your connection and try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New book
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New shared book</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error ? <ErrorState message={error} /> : null}
          <Field
            label="Name"
            value={name}
            maxLength={80}
            placeholder="Household"
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label="Base currency"
            value={currency}
            maxLength={3}
            hint="reports for this book are normalized to it — it can't change later"
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

function JoinDialog() {
  const join = useJoinLedger();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) return setError("Enter the code you were given");

    try {
      const joined = await join.mutateAsync(code.trim());
      setOpen(false);
      setCode("");
      toast.success(`Joined ${joined.name}. Switch to it to see the shared entries.`);
    } catch {
      setError("That code didn't work. Check it hasn't expired.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Join with a code
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Join a book</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error ? <ErrorState message={error} /> : null}
          <Field
            label="Invite code"
            value={code}
            maxLength={16}
            placeholder="K7M2QX9B"
            className={cn("font-mono")}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={join.isPending}>
              {join.isPending ? "Joining…" : "Join"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
