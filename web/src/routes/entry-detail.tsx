import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { Field } from "@/components/field";
import { Amount } from "@/components/money";
import { ErrorState, LoadingRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HTTPError } from "@/lib/api";
import { useAccounts, useDeleteEntry, useEntry, useUpdateEntryMemo } from "@/lib/queries";
import { useWording } from "@/lib/wording";

/**
 * One entry, with the two things a posted entry allows: relabel it, or remove
 * it.
 *
 * Amounts, accounts and the date are not editable — they *are* the posting. To
 * correct one, delete this entry and record the right one, which is what the
 * ledger service enforces regardless of what this screen offered.
 */
export function EntryDetailRoute() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useWording();

  const entryQ = useEntry(id);
  const { data: accounts } = useAccounts();
  const updateMemo = useUpdateEntryMemo();
  const remove = useDeleteEntry();

  const [memo, setMemo] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Adopt the server's memo once per entry, not on every `data` identity change:
  // a background refetch (window focus, or the invalidation a sibling mutation
  // fires) hands back a fresh object, and re-seeding from it would wipe whatever
  // the user had half-typed into the field.
  const seeded = useRef<string | null>(null);
  useEffect(() => {
    if (entryQ.data && seeded.current !== entryQ.data.id) {
      seeded.current = entryQ.data.id;
      setMemo(entryQ.data.memo);
    }
  }, [entryQ.data]);

  const entry = entryQ.data;
  const nameOf = (accountId: string) =>
    accounts?.find((a) => a.id === accountId)?.name ?? "Unknown account";

  const debit = entry?.lines.find((l) => l.dc === "debit");
  const credit = entry?.lines.find((l) => l.dc === "credit");
  const dirty = !!entry && memo.trim() !== entry.memo;

  async function saveMemo() {
    setFailure(null);
    try {
      await updateMemo.mutateAsync({ id, memo: memo.trim() });
    } catch {
      setFailure("Couldn't save the memo. Check your connection and try again.");
    }
  }

  async function confirmDelete() {
    setFailure(null);
    try {
      await remove.mutateAsync(id);
      navigate(-1);
    } catch (err) {
      setConfirming(false);
      setFailure(
        err instanceof HTTPError && err.status === 404
          ? "That entry is already gone."
          : "Couldn't delete. Check your connection and try again.",
      );
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && navigate(-1)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Entry</DialogTitle>
        </DialogHeader>

        {entryQ.isPending ? (
          <LoadingRows rows={3} />
        ) : entryQ.error || !entry ? (
          <ErrorState
            message="Couldn't load this entry."
            onRetry={() => void entryQ.refetch()}
          />
        ) : (
          <div className="space-y-4">
            {failure ? <ErrorState message={failure} /> : null}

            <div className="bg-surface-container rounded-lg p-4">
              <Amount currency={entry.currency} minor={debit?.amount_minor ?? 0} size="lg" />
              <p className="text-caption text-faint mt-1">
                {new Date(entry.txn_date).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            <dl className="divide-outline-variant divide-y">
              <div className="flex items-center justify-between py-2">
                <dt className="text-body text-dim">{t("outOf")}</dt>
                <dd className="text-body text-ink">{credit ? nameOf(credit.account_id) : "—"}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-body text-dim">{t("into")}</dt>
                <dd className="text-body text-ink">{debit ? nameOf(debit.account_id) : "—"}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-body text-dim">Source</dt>
                <dd className="text-body text-ink">{entry.source}</dd>
              </div>
            </dl>

            <Field
              label="Memo"
              value={memo}
              maxLength={500}
              hint="the only field a posted entry lets you change"
              onChange={(e) => setMemo(e.target.value)}
            />

            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirming(true)}
                className="text-error-strong hover:bg-error-wash gap-1.5"
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
              <Button onClick={saveMemo} disabled={!dirty || updateMemo.isPending}>
                {updateMemo.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </div>
        )}

        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete this entry?</DialogTitle>
              <DialogDescription>
                Its money comes straight back out of your balances and reports. This can&rsquo;t be
                undone from here.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={remove.isPending}
                className="bg-error text-on-error hover:bg-error-strong"
              >
                {remove.isPending ? "Deleting…" : "Delete entry"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
