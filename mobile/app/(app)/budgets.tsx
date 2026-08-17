import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { authedApi, type BudgetWithSpent } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { database } from "../../src/lib/db";
import { format, toMinor } from "../../src/lib/money";
import { useObservable } from "../../src/lib/useObserve";
import { useStrings } from "../../src/lib/wording";
import { Account } from "../../src/model/models";
import {
  AmountField,
  Button,
  Card,
  ChipGroup,
  Dialog,
  EmptyState,
  ErrorNotice,
  IconBox,
  ProgressBar,
  SectionLabel,
  Sheet,
  Skeleton,
  Target,
  accountGlyph,
  categorySlot,
  formatGrouped,
  ScreenHeader,
  useTheme,
} from "../../src/components/ui";
import { messageFor } from "../../src/lib/errors";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function Budgets() {
  const { user, baseCurrency: base } = useAuth();
  const s = useStrings();
  const { C } = useTheme();
  const period = currentMonth();
  const [items, setItems] = useState<BudgetWithSpent[]>([]);
  const [err, setErr] = useState<string | null>(null);
  // Distinct from `items.length === 0`: without it the first paint claims "no
  // budgets this month" while the request is still in flight, which reads as an
  // answer rather than a wait.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const accountsObs = useMemo(() => database.get<Account>("accounts").query().observe(), []);
  const accounts = useObservable(accountsObs, [] as Account[]);
  const expenseAccounts = useMemo(
    () => accounts.filter((a) => a.type === "expense" && !a.archived),
    [accounts],
  );

  const existingIds = new Set(items.map((b) => b.account_id));
  const availableExpenses = expenseAccounts.filter((a) => !existingIds.has(a.id));

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formAccountId, setFormAccountId] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  // Deleting a budget is irreversible from the UI, so it goes through a dialog.
  const [pendingDelete, setPendingDelete] = useState<BudgetWithSpent | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // One loader for the mount, the pull-to-refresh and the post-save refetch —
  // they were three near-copies that had already drifted on error handling.
  // Only the newest fetch may write: a response outliving the account or period
  // that asked for it is discarded, not rendered.
  const gen = useRef(0);

  const fetchBudgets = useCallback(async () => {
    const mine = ++gen.current;
    setErr(null);
    try {
      const rows = await authedApi.listBudgets(period);
      if (mine === gen.current) setItems(rows);
    } catch (e) {
      if (mine === gen.current) setErr(messageFor(e, s.budgets.loadFailed));
    }
  }, [period, s]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchBudgets();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
      gen.current++; // retire whatever is still in flight
    };
    // `user` is a dependency because switching account must not show the
    // previous one's plan.
  }, [fetchBudgets, user]);

  async function refresh() {
    setRefreshing(true);
    await fetchBudgets();
    setRefreshing(false);
  }

  const accountFor = (id: string) => accounts.find((a) => a.id === id);
  const nameFor = (id: string) => accountFor(id)?.name ?? s.common.missing;

  const spentTotal = items.reduce((s, b) => s + b.spent_minor, 0);
  const targetTotal = items.reduce((s, b) => s + b.target_minor, 0);
  const overallPct = targetTotal > 0 ? (spentTotal / targetTotal) * 100 : 0;

  function openNew() {
    setEditingId(null);
    setFormAccountId(null);
    setFormTarget("");
    setFormErr(null);
    setShowForm(true);
  }

  function openEdit(b: BudgetWithSpent) {
    setEditingId(b.id);
    setFormAccountId(b.account_id);
    setFormTarget(format(b.currency, b.target_minor));
    setFormErr(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setFormBusy(false);
    setFormErr(null);
  }

  async function saveBudget() {
    setFormErr(null);
    const id = editingId;
    const accountId = formAccountId ?? "";
    if (!accountId) { setFormErr(s.budgets.form.noCategory); return; }
    if (!formTarget) { setFormErr(s.budgets.form.noAmount); return; }
    let minor: number;
    try {
      const a = expenseAccounts.find((ac) => ac.id === accountId) ?? accountFor(accountId);
      minor = toMinor(a?.currency ?? base, formTarget);
    } catch { setFormErr(s.budgets.form.badAmount); return; }
    if (minor <= 0) { setFormErr(s.budgets.form.zeroAmount); return; }

    setFormBusy(true);
    try {
      if (id) {
        await authedApi.updateBudget(id, minor);
      } else {
        await authedApi.setBudget(accountId, period, minor);
      }
      closeForm();
      void fetchBudgets();
    } catch (e) {
      setFormErr(messageFor(e, s.budgets.form.saveFailed));
    } finally {
      setFormBusy(false);
    }
  }

  async function confirmDelete() {
    const b = pendingDelete;
    if (!b) return;
    setDeleteBusy(true);
    try {
      await authedApi.deleteBudget(b.id);
      setPendingDelete(null);
      void fetchBudgets();
    } catch (e) {
      setErr(messageFor(e, s.budgets.deleteFailed));
      setPendingDelete(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  const formCurrency = expenseAccounts.find((a) => a.id === formAccountId)?.currency ?? base;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader
        title={s.budgets.title}
        backLabel={s.budgets.backLabel}
        backAccessibilityLabel={s.common.backTo(s.budgets.backLabel)}
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
          <View className="flex-row items-end justify-between mb-3">
            <View>
              <SectionLabel>{s.budgets.totalSpent}</SectionLabel>
              <Text className="text-ink text-amount-lg font-mono-bold mt-1">
                {base}&nbsp;{formatGrouped(base, spentTotal)}
              </Text>
            </View>
            <View className="items-end">
              <SectionLabel>{s.budgets.budget}</SectionLabel>
              <Text className="text-faint text-amount font-mono-bold mt-1">
                {base}&nbsp;{formatGrouped(base, targetTotal)}
              </Text>
            </View>
          </View>
          <ProgressBar pct={overallPct} />
          <View className="flex-row justify-between mt-2">
            <Text
              className={`text-amount-sm font-mono-bold ${
                overallPct >= 100 ? "text-error" : overallPct >= 75 ? "text-warning" : "text-success"
              }`}
            >
              {s.budgets.used(Math.round(overallPct))}
            </Text>
            <Text className="text-caption font-sans-medium text-faint">
              {s.budgets.periodTitle(period)}
            </Text>
          </View>
        </Card>

        {err && (
          <View className="mb-card-gap">
            <ErrorNotice message={err} onRetry={() => void fetchBudgets()} />
          </View>
        )}

        {loading && (
          <Card className="mb-card-gap">
            <Skeleton className="h-3 w-28 mb-3" />
            <Skeleton className="h-10 w-full mb-3" />
            <Skeleton className="h-10 w-full" />
          </Card>
        )}

        {!loading && items.length === 0 && !err && (
          <View className="mb-card-gap">
            <EmptyState
              glyph={Target}
              title={s.budgets.empty.title}
              body={s.budgets.empty.body}
            />
          </View>
        )}

        {items.length > 0 && (
          <Card padded={false} className="mb-card-gap">
            {items.map((b, i) => {
              const pct = b.target_minor > 0 ? (b.spent_minor / b.target_minor) * 100 : 0;
              const account = accountFor(b.account_id);
              return (
                <View key={b.id}>
                  {i > 0 && <View className="h-px bg-outline-variant ml-4" />}
                  <View className="px-4 py-3.5">
                    <View className="flex-row items-center gap-card-gap mb-2">
                      <IconBox
                        glyph={accountGlyph(account?.name ?? "", account?.type)}
                        slot={categorySlot(b.account_id)}
                      />
                      <View className="flex-1 min-w-0">
                        <Text className="text-ink text-body-strong font-sans-semibold" numberOfLines={1}>
                          {nameFor(b.account_id)}
                        </Text>
                        <Text className="text-faint text-mono-meta font-mono">
                          {s.budgets.spentOfTarget(
                            b.currency,
                            formatGrouped(b.currency, b.spent_minor),
                            formatGrouped(b.currency, b.target_minor),
                          )}
                        </Text>
                      </View>
                      <Text
                        className={`text-amount-sm font-mono-bold ${
                          pct >= 100 ? "text-error" : pct >= 75 ? "text-warning" : "text-success"
                        }`}
                      >
                        {s.budgets.categoryPct(Math.round(pct))}
                      </Text>
                    </View>
                    <ProgressBar pct={pct} />
                    <View className="flex-row justify-end mt-1" style={{ gap: 4 }}>
                      <Button
                        label={s.common.edit}
                        variant="tertiary"
                        fullWidth={false}
                        onPress={() => openEdit(b)}
                      />
                      <Button
                        label={s.common.delete}
                        variant="tertiary"
                        fullWidth={false}
                        onPress={() => setPendingDelete(b)}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        <Button
          label={availableExpenses.length > 0 ? s.budgets.setBudget : s.budgets.editTargets}
          onPress={openNew}
        />
      </ScrollView>

      <Sheet
        visible={showForm}
        onClose={closeForm}
        title={editingId ? s.budgets.editBudget : s.budgets.setBudget}
      >
        {!editingId && (
          <ChipGroup
            label={s.budgets.category}
            value={formAccountId}
            options={availableExpenses.map((a) => ({ value: a.id, label: a.name }))}
            emptyText={s.budgets.everyCategoryBudgeted}
            onSelect={setFormAccountId}
          />
        )}

        {editingId && (
          <View className="mb-4">
            <Text className="text-label font-sans-semibold text-ink mb-1.5">
              {s.budgets.category}
            </Text>
            <View className="bg-surface-container rounded-xl px-4 py-3 min-h-touch justify-center">
              <Text className="text-body font-sans-medium text-ink">
                {nameFor(formAccountId ?? "")}
              </Text>
            </View>
          </View>
        )}

        <AmountField
          label={s.budgets.monthlyTarget}
          value={formTarget}
          onChange={setFormTarget}
          currency={formCurrency}
          error={formErr}
        />

        <Button label={s.common.save} onPress={saveBudget} busy={formBusy} />
      </Sheet>

      <Dialog
        visible={pendingDelete != null}
        title={s.budgets.confirmDelete.title}
        body={
          pendingDelete
            ? s.budgets.confirmDelete.body(nameFor(pendingDelete.account_id))
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
