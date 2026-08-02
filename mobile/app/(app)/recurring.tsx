import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { authedApi, type RecurringRule, type RecurringTemplate } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { database } from "../../src/lib/db";
import { format, toMinor } from "../../src/lib/money";
import { useObservable } from "../../src/lib/useObserve";
import { Account } from "../../src/model/models";
import {
  AmountField,
  Badge,
  Button,
  Card,
  ChipGroup,
  Dialog,
  EmptyState,
  Field,
  IconBox,
  Repeat,
  SectionLabel,
  Sheet,
} from "../../src/components/ui";

type Freq = "daily" | "weekly" | "monthly";

// Rules are authored as three plain choices (how often, which day, how much)
// and compiled to an RRULE here — the ledger's double-entry shape and the
// iCalendar syntax both stay behind the UI, per the plan's "hide DE behind a
// friendly picker" rule.
function buildRRule(freq: Freq, monthDay: number, weekDay: string): string {
  switch (freq) {
    case "daily":
      return "FREQ=DAILY";
    case "weekly":
      return `FREQ=WEEKLY;BYDAY=${weekDay}`;
    case "monthly":
      return `FREQ=MONTHLY;BYMONTHDAY=${monthDay}`;
  }
}

// Reads an RRULE back into the form's fields so editing shows what was saved.
function parseRRule(rrule: string): { freq: Freq; monthDay: number; weekDay: string } {
  const parts = Object.fromEntries(
    rrule
      .replace(/^RRULE:/, "")
      .split(";")
      .map((p) => p.split("=") as [string, string]),
  );
  const freq: Freq =
    parts.FREQ === "DAILY" ? "daily" : parts.FREQ === "WEEKLY" ? "weekly" : "monthly";
  return {
    freq,
    monthDay: Number(parts.BYMONTHDAY ?? 1) || 1,
    weekDay: parts.BYDAY ?? "MO",
  };
}

const WEEKDAYS: { value: string; label: string }[] = [
  { value: "MO", label: "Mon" },
  { value: "TU", label: "Tue" },
  { value: "WE", label: "Wed" },
  { value: "TH", label: "Thu" },
  { value: "FR", label: "Fri" },
  { value: "SA", label: "Sat" },
  { value: "SU", label: "Sun" },
];

function describe(rule: RecurringRule): string {
  const { freq, monthDay, weekDay } = parseRRule(rule.rrule);
  if (freq === "daily") return "Every day";
  if (freq === "weekly") return `Every ${WEEKDAYS.find((d) => d.value === weekDay)?.label ?? weekDay}`;
  return `Monthly on the ${monthDay}${ordinal(monthDay)}`;
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

function formatDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// The expense leg is the debit and the pocket is the credit — the same shape
// entry-new builds for a one-off expense.
function buildTemplate(
  currency: string,
  categoryId: string,
  pocketId: string,
  amountMinor: number,
  memo: string,
): RecurringTemplate {
  return {
    currency,
    memo,
    source: "recurring",
    lines: [
      { account_id: categoryId, dc: "debit", amount_minor: amountMinor },
      { account_id: pocketId, dc: "credit", amount_minor: amountMinor },
    ],
  };
}

export default function Recurring() {
  const { user } = useAuth();
  const base = user?.base_currency ?? "IDR";

  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const accountsObs = useMemo(() => database.get<Account>("accounts").query().observe(), []);
  const accounts = useObservable(accountsObs, [] as Account[]);
  const categories = useMemo(
    () => accounts.filter((a) => a.type === "expense" && !a.archived),
    [accounts],
  );
  const pockets = useMemo(
    () => accounts.filter((a) => (a.type === "asset" || a.type === "liability") && !a.archived),
    [accounts],
  );

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [freq, setFreq] = useState<Freq>("monthly");
  const [monthDay, setMonthDay] = useState(1);
  const [weekDay, setWeekDay] = useState("MO");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [pocketId, setPocketId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  // Deleting a rule is irreversible from the UI, so it goes through a dialog.
  const [pendingDelete, setPendingDelete] = useState<RecurringRule | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchRules = useCallback(() => {
    setErr(null);
    authedApi.listRecurring().then(setRules).catch((e) => {
      setErr(e instanceof Error ? e.message : "failed to load recurring rules");
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    authedApi.listRecurring().then((rs) => {
      if (!cancelled) setRules(rs);
    }).catch((e) => {
      if (!cancelled) setErr(e instanceof Error ? e.message : "failed to load recurring rules");
    });
    return () => { cancelled = true; };
  }, [user]);

  const nameFor = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";

  function openNew() {
    setEditingId(null);
    setFreq("monthly");
    setMonthDay(new Date().getDate() > 28 ? 1 : new Date().getDate());
    setWeekDay("MO");
    setCategoryId(null);
    setPocketId(null);
    setAmount("");
    setMemo("");
    setFormErr(null);
    setShowForm(true);
  }

  function openEdit(rule: RecurringRule) {
    const parsed = parseRRule(rule.rrule);
    const debit = rule.template.lines.find((l) => l.dc === "debit");
    const credit = rule.template.lines.find((l) => l.dc === "credit");
    setEditingId(rule.id);
    setFreq(parsed.freq);
    setMonthDay(parsed.monthDay);
    setWeekDay(parsed.weekDay);
    setCategoryId(debit?.account_id ?? null);
    setPocketId(credit?.account_id ?? null);
    setAmount(debit ? format(rule.template.currency, debit.amount_minor) : "");
    setMemo(rule.template.memo ?? "");
    setFormErr(null);
    setShowForm(true);
  }

  async function saveRule() {
    setFormErr(null);
    if (!categoryId) { setFormErr("Select a category"); return; }
    if (!pocketId) { setFormErr("Select a pocket to pay from"); return; }

    const currency = accounts.find((a) => a.id === categoryId)?.currency ?? base;
    const pocketCurrency = accounts.find((a) => a.id === pocketId)?.currency;
    if (pocketCurrency && pocketCurrency !== currency) {
      setFormErr("Category and pocket must use the same currency");
      return;
    }
    let minor: number;
    try {
      minor = toMinor(currency, amount);
    } catch { setFormErr("Enter a valid amount"); return; }
    if (minor <= 0) { setFormErr("Amount must be greater than zero"); return; }

    const rrule = buildRRule(freq, monthDay, weekDay);
    const template = buildTemplate(currency, categoryId, pocketId, minor, memo);

    setFormBusy(true);
    try {
      if (editingId) {
        await authedApi.updateRecurring(editingId, rrule, template, true);
      } else {
        await authedApi.createRecurring(rrule, template);
      }
      setShowForm(false);
      fetchRules();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "save failed");
    } finally {
      setFormBusy(false);
    }
  }

  async function confirmDelete() {
    const rule = pendingDelete;
    if (!rule) return;
    setDeleteBusy(true);
    try {
      await authedApi.deleteRecurring(rule.id);
      setPendingDelete(null);
      fetchRules();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "delete failed");
      setPendingDelete(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  // The server sweeps on its own schedule; this is the "don't wait" affordance.
  // Posting is idempotent per occurrence, so tapping twice can't double-post.
  async function runDue() {
    if (running) return;
    setRunning(true);
    setNotice(null);
    try {
      const res = await authedApi.triggerRecurring();
      setNotice(res.count > 0 ? `Posted ${res.count} entr${res.count === 1 ? "y" : "ies"}` : "Nothing due right now");
      fetchRules();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "run failed");
    } finally {
      setRunning(false);
    }
  }

  const formCurrency = accounts.find((a) => a.id === categoryId)?.currency ?? base;
  const active = rules.filter((r) => r.active);

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Card className="mb-card-gap">
          <SectionLabel>Scheduled</SectionLabel>
          <Text className="text-ink text-amount-lg font-mono-bold mt-1">
            {active.length} active
          </Text>
          <Text className="text-faint text-caption font-sans-medium mt-1">
            entries post automatically on their date
          </Text>
          <View className="mt-2 self-start">
            <Button
              label={running ? "Running…" : "Run due now"}
              variant="tertiary"
              fullWidth={false}
              disabled={running}
              onPress={runDue}
            />
          </View>
          {notice && (
            <Text className="text-faint text-mono-meta font-mono mt-2">{notice}</Text>
          )}
        </Card>

        {err && (
          <Card className="mb-card-gap">
            <Text className="text-error text-body font-sans-medium">{err}</Text>
          </Card>
        )}

        {rules.length === 0 && !err && (
          <View className="mb-card-gap">
            <EmptyState
              glyph={Repeat}
              title="Nothing recurring yet"
              body="Add rent, a subscription, or salary and it posts itself on schedule."
            />
          </View>
        )}

        {rules.length > 0 && (
          <Card padded={false} className="mb-card-gap">
            {rules.map((rule, i) => {
              const debit = rule.template.lines.find((l) => l.dc === "debit");
              const credit = rule.template.lines.find((l) => l.dc === "credit");
              return (
                <View key={rule.id}>
                  {i > 0 && <View className="h-px bg-outline-variant ml-[68px]" />}
                  <View className="px-4 py-3.5">
                    <View className="flex-row items-center gap-card-gap">
                      <IconBox glyph={Repeat} />
                      <View className="flex-1 min-w-0">
                        <Text
                          className="text-ink text-body-strong font-sans-semibold"
                          numberOfLines={1}
                        >
                          {rule.template.memo || nameFor(debit?.account_id ?? "")}
                        </Text>
                        <Text className="text-faint text-caption font-sans-medium">
                          {describe(rule)} · from {nameFor(credit?.account_id ?? "")}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-ink text-amount-sm font-mono-bold">
                          {rule.template.currency}&nbsp;
                          {debit ? format(rule.template.currency, debit.amount_minor) : "—"}
                        </Text>
                        <Text className="text-faint text-mono-meta font-mono mt-0.5">
                          next {formatDate(rule.next_run)}
                        </Text>
                      </View>
                    </View>

                    {!rule.active && (
                      <View className="mt-2 self-start">
                        <Badge tone="neutral">Paused</Badge>
                      </View>
                    )}
                    {/* A rule that keeps failing (archived account, say) has to be
                        visible here — otherwise it silently stops posting. */}
                    {rule.last_error && (
                      <Text className="text-error text-caption font-sans-medium mt-2">
                        Last run failed: {rule.last_error}
                      </Text>
                    )}

                    <View className="flex-row justify-end mt-1" style={{ gap: 4 }}>
                      <Button
                        label="Edit"
                        variant="tertiary"
                        fullWidth={false}
                        onPress={() => openEdit(rule)}
                      />
                      <Button
                        label="Delete"
                        variant="tertiary"
                        fullWidth={false}
                        onPress={() => setPendingDelete(rule)}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        <Button label="New recurring" onPress={openNew} />
      </ScrollView>

      <Sheet
        visible={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? "Edit recurring" : "New recurring"}
      >
        <ChipGroup
          label="How often"
          value={freq}
          options={[
            { value: "daily" as Freq, label: "Daily" },
            { value: "weekly" as Freq, label: "Weekly" },
            { value: "monthly" as Freq, label: "Monthly" },
          ]}
          onSelect={setFreq}
        />

        {freq === "weekly" && (
          <ChipGroup label="On" value={weekDay} options={WEEKDAYS} onSelect={setWeekDay} />
        )}

        {freq === "monthly" && (
          <ChipGroup
            label="Day of month"
            value={String(monthDay)}
            // Capped at 28 so every month has the day — no "31st in
            // February" surprises.
            options={Array.from({ length: 28 }, (_, i) => ({
              value: String(i + 1),
              label: String(i + 1),
            }))}
            onSelect={(v) => setMonthDay(Number(v))}
          />
        )}

        <ChipGroup
          label="Category"
          value={categoryId}
          options={categories.map((a) => ({ value: a.id, label: a.name }))}
          onSelect={setCategoryId}
        />

        <ChipGroup
          label="Pay from"
          value={pocketId}
          options={pockets.map((a) => ({ value: a.id, label: a.name }))}
          onSelect={setPocketId}
        />

        <AmountField
          label="Amount"
          value={amount}
          onChange={setAmount}
          currency={formCurrency}
        />

        <Field label="Memo" value={memo} onChange={setMemo} placeholder="Rent" error={formErr} />

        <Button label="Save" onPress={saveRule} busy={formBusy} />
      </Sheet>

      <Dialog
        visible={pendingDelete != null}
        title="Delete this rule?"
        body={
          pendingDelete
            ? `"${pendingDelete.template.memo || "This rule"}" stops posting. Entries it already created stay in the ledger.`
            : undefined
        }
        confirmLabel="Delete"
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </View>
  );
}
