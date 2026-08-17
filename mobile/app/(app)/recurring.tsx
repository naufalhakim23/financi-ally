import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { authedApi, type RecurringRule, type RecurringTemplate } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { database } from "../../src/lib/db";
import { format, toMinor } from "../../src/lib/money";
import {
  MAX_MONTH_DAY,
  WEEKDAYS,
  buildRRule,
  describeRRule,
  parseRRule,
  type Freq,
} from "../../src/lib/recurrence";
import { useObservable } from "../../src/lib/useObserve";
import { useStrings } from "../../src/lib/wording";
import { Account } from "../../src/model/models";
import {
  AmountField,
  Badge,
  Button,
  Card,
  ChipGroup,
  Dialog,
  EmptyState,
  ErrorNotice,
  Field,
  IconBox,
  Repeat,
  SectionLabel,
  Skeleton,
  Sheet,
  ScreenHeader,
  formatGrouped,
  useTheme,
} from "../../src/components/ui";
import { messageFor } from "../../src/lib/errors";

function formatDate(d: string | null | undefined, missing: string): string {
  if (!d) return missing;
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
  const { user, baseCurrency: base } = useAuth();
  const s = useStrings();
  const { C } = useTheme();

  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [err, setErr] = useState<string | null>(null);
  // Distinct from `rules.length === 0`: without it the first paint claims
  // "nothing recurring yet" while the request is still in flight.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  // One loader for mount, pull-to-refresh and the post-save refetch.
  // Only the newest fetch may write: a response outliving the account that
  // asked for it is discarded, not rendered.
  const gen = useRef(0);

  const fetchRules = useCallback(async () => {
    const mine = ++gen.current;
    setErr(null);
    try {
      const rows = await authedApi.listRecurring();
      if (mine === gen.current) setRules(rows);
    } catch (e) {
      if (mine === gen.current) setErr(messageFor(e, s.recurring.loadFailed));
    }
  }, [s]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchRules();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
      gen.current++; // retire whatever is still in flight
    };
  }, [fetchRules, user]);

  async function refresh() {
    setRefreshing(true);
    await fetchRules();
    setRefreshing(false);
  }

  const nameFor = (id: string) => accounts.find((a) => a.id === id)?.name ?? s.common.missing;

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
    if (!categoryId) { setFormErr(s.recurring.form.noCategory); return; }
    if (!pocketId) { setFormErr(s.recurring.form.noPocket); return; }

    const currency = accounts.find((a) => a.id === categoryId)?.currency ?? base;
    const pocketCurrency = accounts.find((a) => a.id === pocketId)?.currency;
    if (pocketCurrency && pocketCurrency !== currency) {
      setFormErr(s.recurring.form.currencyMismatch);
      return;
    }
    let minor: number;
    try {
      minor = toMinor(currency, amount);
    } catch { setFormErr(s.recurring.form.badAmount); return; }
    if (minor <= 0) { setFormErr(s.recurring.form.zeroAmount); return; }

    const rrule = buildRRule({ freq, monthDay, weekDay });
    const template = buildTemplate(currency, categoryId, pocketId, minor, memo);

    setFormBusy(true);
    try {
      if (editingId) {
        await authedApi.updateRecurring(editingId, rrule, template, true);
      } else {
        await authedApi.createRecurring(rrule, template);
      }
      setShowForm(false);
      void fetchRules();
    } catch (e) {
      setFormErr(messageFor(e, s.recurring.form.saveFailed));
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
      void fetchRules();
    } catch (e) {
      setErr(messageFor(e, s.recurring.deleteFailed));
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
      setNotice(res.count > 0 ? s.recurring.posted(res.count) : s.recurring.nothingDue);
      void fetchRules();
    } catch (e) {
      setErr(messageFor(e, s.recurring.runFailed));
    } finally {
      setRunning(false);
    }
  }

  const formCurrency = accounts.find((a) => a.id === categoryId)?.currency ?? base;
  const active = rules.filter((r) => r.active);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader
        title={s.recurring.title}
        backLabel={s.recurring.backLabel}
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.dim} />
        }
      >
        <Card className="mb-card-gap">
          <SectionLabel>{s.recurring.scheduled}</SectionLabel>
          <Text className="text-ink text-amount-lg font-mono-bold mt-1">
            {s.recurring.activeCount(active.length)}
          </Text>
          <Text className="text-faint text-caption font-sans-medium mt-1">
            {s.recurring.postsAutomatically}
          </Text>
          <View className="mt-2 self-start">
            <Button
              label={running ? s.recurring.running : s.recurring.runDue}
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
          <View className="mb-card-gap">
            <ErrorNotice message={err} onRetry={() => void fetchRules()} />
          </View>
        )}

        {loading && (
          <Card className="mb-card-gap">
            <Skeleton className="h-4 w-40 mb-3" />
            <Skeleton className="h-4 w-28" />
          </Card>
        )}

        {!loading && rules.length === 0 && !err && (
          <View className="mb-card-gap">
            <EmptyState
              glyph={Repeat}
              title={s.recurring.empty.title}
              body={s.recurring.empty.body}
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
                  {i > 0 && <View className="h-px bg-outline-variant ml-row-inset" />}
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
                          {s.recurring.ruleFrom(
                            describeRRule(rule.rrule),
                            nameFor(credit?.account_id ?? ""),
                          )}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-ink text-amount-sm font-mono-bold">
                          {rule.template.currency}&nbsp;
                          {debit
                            ? formatGrouped(rule.template.currency, debit.amount_minor)
                            : s.common.missing}
                        </Text>
                        <Text className="text-faint text-mono-meta font-mono mt-0.5">
                          {s.recurring.nextRun(formatDate(rule.next_run, s.common.missing))}
                        </Text>
                      </View>
                    </View>

                    {!rule.active && (
                      <View className="mt-2 self-start">
                        <Badge tone="neutral">{s.recurring.paused}</Badge>
                      </View>
                    )}
                    {/* A rule that keeps failing (archived account, say) has to be
                        visible here — otherwise it silently stops posting. */}
                    {rule.last_error && (
                      <Text className="text-error text-caption font-sans-medium mt-2">
                        {s.recurring.lastRunFailed(rule.last_error)}
                      </Text>
                    )}

                    <View className="flex-row justify-end mt-1" style={{ gap: 4 }}>
                      <Button
                        label={s.common.edit}
                        variant="tertiary"
                        fullWidth={false}
                        onPress={() => openEdit(rule)}
                      />
                      <Button
                        label={s.common.delete}
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

        <Button label={s.recurring.newRule} onPress={openNew} />
      </ScrollView>

      <Sheet
        visible={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? s.recurring.editRule : s.recurring.newRule}
      >
        <ChipGroup
          label={s.recurring.howOften}
          value={freq}
          options={[
            { value: "daily" as Freq, label: s.recurring.freq.daily },
            { value: "weekly" as Freq, label: s.recurring.freq.weekly },
            { value: "monthly" as Freq, label: s.recurring.freq.monthly },
          ]}
          onSelect={setFreq}
        />

        {freq === "weekly" && (
          <ChipGroup label={s.recurring.on} value={weekDay} options={WEEKDAYS} onSelect={setWeekDay} />
        )}

        {freq === "monthly" && (
          <ChipGroup
            label={s.recurring.dayOfMonth}
            value={String(monthDay)}
            // Capped so every month has the day — no "31st in February"
            // surprises. The cap lives in the shared recurrence module.
            options={Array.from({ length: MAX_MONTH_DAY }, (_, i) => ({
              value: String(i + 1),
              label: String(i + 1),
            }))}
            onSelect={(v) => setMonthDay(Number(v))}
          />
        )}

        <ChipGroup
          label={s.recurring.category}
          value={categoryId}
          options={categories.map((a) => ({ value: a.id, label: a.name }))}
          onSelect={setCategoryId}
        />

        <ChipGroup
          label={s.recurring.payFrom}
          value={pocketId}
          options={pockets.map((a) => ({ value: a.id, label: a.name }))}
          onSelect={setPocketId}
        />

        <AmountField
          label={s.recurring.amount}
          value={amount}
          onChange={setAmount}
          currency={formCurrency}
        />

        <Field
          label={s.recurring.memo}
          value={memo}
          onChange={setMemo}
          placeholder={s.recurring.memoPlaceholder}
          error={formErr}
        />

        <Button label={s.common.save} onPress={saveRule} busy={formBusy} />
      </Sheet>

      <Dialog
        visible={pendingDelete != null}
        title={s.recurring.confirmDelete.title}
        body={
          pendingDelete
            ? s.recurring.confirmDelete.body(
                pendingDelete.template.memo || s.recurring.confirmDelete.fallbackName,
              )
            : undefined
        }
        confirmLabel={s.common.delete}
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </SafeAreaView>
  );
}
