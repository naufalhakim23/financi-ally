import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { authedApi, type BudgetWithSpent } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { database } from "../../src/lib/db";
import { format, toMinor } from "../../src/lib/money";
import { useObservable } from "../../src/lib/useObserve";
import { Account } from "../../src/model/models";
import { AmountField, Picker, PrimaryButton } from "../../src/components/forms";
import { Card, EmptyState, IconBox, ProgressBar, SectionLabel } from "../../src/components/ui";

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

  const nameFor = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";

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
      const a = expenseAccounts.find((ac) => ac.id === accountId) ?? accounts.find((ac) => ac.id === accountId);
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

  async function deleteBudget(id: string) {
    try {
      await authedApi.deleteBudget(id);
      fetchBudgets();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "delete failed");
    }
  }

  const formCurrency = expenseAccounts.find((a) => a.id === formAccountId)?.currency ?? base;

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      >
        <Card className="mb-4">
          <View className="flex-row items-end justify-between mb-3">
            <View>
              <SectionLabel>Total spent</SectionLabel>
              <Text className="text-ink text-[26px] font-mono-bold mt-1 leading-none">
                {format(base, spentTotal)}
              </Text>
            </View>
            <View className="items-end">
              <SectionLabel>Budget</SectionLabel>
              <Text className="text-faint text-[20px] font-mono-bold mt-1 leading-none">
                {format(base, targetTotal)}
              </Text>
            </View>
          </View>
          <ProgressBar pct={overallPct} />
          <View className="flex-row justify-between mt-2">
            <Text
              className={`text-[10px] font-mono-bold ${
                overallPct >= 100 ? "text-error" : overallPct >= 75 ? "text-warning" : "text-success"
              }`}
            >
              {Math.round(overallPct)}% used
            </Text>
            <Text className="text-[10px] font-mono text-faint">{period.slice(0, 7)}</Text>
          </View>
        </Card>

        {err && (
          <Card className="mb-4">
            <Text className="text-error text-sm">{err}</Text>
          </Card>
        )}

        {items.length === 0 && !err && (
          <View className="mb-4">
            <EmptyState
              icon="🎯"
              title="No budgets this month"
              body="Set a monthly target on a category to see spent-vs-target here."
            />
          </View>
        )}

        {items.length > 0 && (
          <Card padded={false} className="mb-4">
            {items.map((b, i) => {
              const pct = b.target_minor > 0 ? (b.spent_minor / b.target_minor) * 100 : 0;
              const last = i === items.length - 1;
              return (
                <View
                  key={b.id}
                  className={`px-4 py-3.5 ${last ? "" : "border-b border-outline-variant"}`}
                >
                  <Pressable onPress={() => openEdit(b)}>
                    <View className="flex-row items-center mb-2" style={{ gap: 10 }}>
                      <IconBox bg="bg-secondary">💸</IconBox>
                      <View className="flex-1">
                        <Text className="text-ink text-[13px] font-sans-semibold">
                          {nameFor(b.account_id)}
                        </Text>
                        <Text className="text-faint text-[10px] font-mono">
                          {format(b.currency, b.spent_minor)} / {format(b.currency, b.target_minor)}
                        </Text>
                      </View>
                      <Text
                        className={`text-[12px] font-mono-bold ${
                          pct >= 100 ? "text-error" : pct >= 75 ? "text-warning" : "text-success"
                        }`}
                      >
                        {Math.round(pct)}%
                      </Text>
                    </View>
                    <ProgressBar pct={pct} />
                  </Pressable>
                  <Pressable onPress={() => deleteBudget(b.id)} className="mt-1 self-end">
                    <Text className="text-error text-[9px] font-sans-semibold">DELETE</Text>
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}

        <PrimaryButton
          label={availableExpenses.length > 0 ? "＋ Set budget" : "Edit targets"}
          onPress={openNew}
          busy={false}
        />
      </ScrollView>

      <Modal visible={showForm} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-background rounded-t-3xl p-6 pb-10" style={{ maxHeight: "80%" }}>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-ink text-lg font-sans-bold">
                {editingId ? "Edit budget" : "Set budget"}
              </Text>
              <Pressable onPress={closeForm}>
                <Text className="text-faint font-sans-semibold">Cancel</Text>
              </Pressable>
            </View>

            {!editingId && (
              <Picker
                label="Category"
                value={formAccountId}
                options={availableExpenses.map((a) => ({ value: a.id, label: a.name }))}
                onSelect={setFormAccountId}
              />
            )}

            {editingId && (
              <View className="mb-4">
                <Text className="text-sm font-sans-semibold text-dim mb-1">Category</Text>
                <View className="bg-surface-container rounded-lg px-4 py-3">
                  <Text className="text-ink font-sans-medium">
                    {nameFor(formAccountId ?? "")}
                  </Text>
                </View>
              </View>
            )}

            <AmountField label="Monthly target" value={formTarget} onChange={setFormTarget} currency={formCurrency} />

            {formErr && <Text className="text-error text-sm mb-3">{formErr}</Text>}

            <PrimaryButton label="Save" onPress={saveBudget} busy={formBusy} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
