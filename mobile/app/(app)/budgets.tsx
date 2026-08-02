import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { authedApi, type BudgetWithSpent } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { database } from "../../src/lib/db";
import { format, toMinor } from "../../src/lib/money";
import { useObservable } from "../../src/lib/useObserve";
import { Account } from "../../src/model/models";
import {
  AmountField,
  Button,
  Card,
  ChipGroup,
  Dialog,
  EmptyState,
  IconBox,
  ProgressBar,
  SectionLabel,
  Sheet,
  Target,
  accountGlyph,
  categorySlot,
  ScreenHeader,
} from "../../src/components/ui";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function Budgets() {
  const { user } = useAuth();
  const base = user?.base_currency ?? "IDR";
  const period = currentMonth();
  const [items, setItems] = useState<BudgetWithSpent[]>([]);
  const [err, setErr] = useState<string | null>(null);

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

  function fetchBudgets() {
    setErr(null);
    authedApi.listBudgets(period).then(setItems).catch((e) => {
      setErr(e instanceof Error ? e.message : "failed to load budgets");
    });
  }

  useEffect(() => {
    let cancelled = false;
    authedApi.listBudgets(period).then((bs) => {
      if (!cancelled) setItems(bs);
    }).catch((e) => {
      if (!cancelled) setErr(e instanceof Error ? e.message : "failed to load budgets");
    });
    return () => { cancelled = true; };
  }, [period, user]);

  const accountFor = (id: string) => accounts.find((a) => a.id === id);
  const nameFor = (id: string) => accountFor(id)?.name ?? "—";

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
    if (!accountId) { setFormErr("Select a category"); return; }
    if (!formTarget) { setFormErr("Enter a budget amount"); return; }
    let minor: number;
    try {
      const a = expenseAccounts.find((ac) => ac.id === accountId) ?? accountFor(accountId);
      minor = toMinor(a?.currency ?? base, formTarget);
    } catch { setFormErr("Enter a valid amount"); return; }
    if (minor <= 0) { setFormErr("Amount must be greater than zero"); return; }

    setFormBusy(true);
    try {
      if (id) {
        await authedApi.updateBudget(id, minor);
      } else {
        await authedApi.setBudget(accountId, period, minor);
      }
      closeForm();
      fetchBudgets();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : "save failed");
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
      fetchBudgets();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "delete failed");
      setPendingDelete(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  const formCurrency = expenseAccounts.find((a) => a.id === formAccountId)?.currency ?? base;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="The spending plan" backLabel="More" onBack={() => router.back()} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      >
        <Card className="mb-card-gap">
          <View className="flex-row items-end justify-between mb-3">
            <View>
              <SectionLabel>Total spent</SectionLabel>
              <Text className="text-ink text-amount-lg font-mono-bold mt-1">
                {base}&nbsp;{format(base, spentTotal)}
              </Text>
            </View>
            <View className="items-end">
              <SectionLabel>Budget</SectionLabel>
              <Text className="text-faint text-amount font-mono-bold mt-1">
                {base}&nbsp;{format(base, targetTotal)}
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
              {Math.round(overallPct)}% used
            </Text>
            <Text className="text-mono-meta font-mono text-faint">{period.slice(0, 7)}</Text>
          </View>
        </Card>

        {err && (
          <Card className="mb-card-gap">
            <Text className="text-error text-body font-sans-medium">{err}</Text>
          </Card>
        )}

        {items.length === 0 && !err && (
          <View className="mb-card-gap">
            <EmptyState
              glyph={Target}
              title="No budgets this month"
              body="Set a monthly target on a category to see spent-vs-target here."
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
                          {b.currency} {format(b.currency, b.spent_minor)} /{" "}
                          {format(b.currency, b.target_minor)}
                        </Text>
                      </View>
                      <Text
                        className={`text-amount-sm font-mono-bold ${
                          pct >= 100 ? "text-error" : pct >= 75 ? "text-warning" : "text-success"
                        }`}
                      >
                        {Math.round(pct)}%
                      </Text>
                    </View>
                    <ProgressBar pct={pct} />
                    <View className="flex-row justify-end mt-1" style={{ gap: 4 }}>
                      <Button
                        label="Edit"
                        variant="tertiary"
                        fullWidth={false}
                        onPress={() => openEdit(b)}
                      />
                      <Button
                        label="Delete"
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
          label={availableExpenses.length > 0 ? "Set budget" : "Edit targets"}
          onPress={openNew}
        />
      </ScrollView>

      <Sheet
        visible={showForm}
        onClose={closeForm}
        title={editingId ? "Edit budget" : "Set budget"}
      >
        {!editingId && (
          <ChipGroup
            label="Category"
            value={formAccountId}
            options={availableExpenses.map((a) => ({ value: a.id, label: a.name }))}
            emptyText="Every category already has a budget"
            onSelect={setFormAccountId}
          />
        )}

        {editingId && (
          <View className="mb-4">
            <Text className="text-label font-sans-semibold text-ink mb-1.5">Category</Text>
            <View className="bg-surface-container rounded-lg px-4 py-3 min-h-touch justify-center">
              <Text className="text-body font-sans-medium text-ink">
                {nameFor(formAccountId ?? "")}
              </Text>
            </View>
          </View>
        )}

        <AmountField
          label="Monthly target"
          value={formTarget}
          onChange={setFormTarget}
          currency={formCurrency}
          error={formErr}
        />

        <Button label="Save" onPress={saveBudget} busy={formBusy} />
      </Sheet>

      <Dialog
        visible={pendingDelete != null}
        title="Delete this budget?"
        body={
          pendingDelete
            ? `${nameFor(pendingDelete.account_id)} loses its monthly target. Spending already logged is not affected.`
            : undefined
        }
        confirmLabel="Delete"
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </SafeAreaView>
  );
}
