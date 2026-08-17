import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import {
  authedApi,
  type Ledger,
  type LedgerMember,
  type LedgerMembership,
} from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { messageFor } from "../../src/lib/errors";
import { switchLedger } from "../../src/lib/ledgers";
import { useLedgerState } from "../../src/lib/ledgerStore";
import { useStrings } from "../../src/lib/wording";
import {
  Badge,
  BookOpen,
  Button,
  Card,
  Dialog,
  ErrorNotice,
  Field,
  ListRow,
  ScreenHeader,
  SectionLabel,
  Sheet,
  Users,
  useTheme,
} from "../../src/components/ui";

// Books: the personal ledger plus any household the user shares. Switching
// wipes and re-pulls the local database, so it goes through a confirmation and
// reports failure inline rather than leaving the user guessing which book
// they're in.

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Ledgers() {
  const { user } = useAuth();
  const { active } = useLedgerState();
  const s = useStrings();
  const { C } = useTheme();

  const [books, setBooks] = useState<LedgerMembership[]>([]);
  const [members, setMembers] = useState<LedgerMember[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // The active book, as the server describes it. Falls back to whichever
  // membership matches the stored id so the header is right before any fetch.
  const current =
    books.find((b) => b.ledger.id === (active?.id ?? "")) ??
    books.find((b) => b.ledger.kind === "personal");
  const isShared = current?.ledger.kind === "household";

  const load = useCallback(async () => {
    setErr(null);
    try {
      setBooks(await authedApi.listLedgers());
    } catch (e) {
      setErr(messageFor(e, s.books.loadFailed));
    }
  }, [s]);

  useEffect(() => {
    load();
  }, [load, user]);

  // Reuses `load` rather than refetching books alone: replacing `books` gives a
  // new `current`, which re-runs the members effect below, so the member list
  // under the book can't go stale.
  async function refresh() {
    setRefreshing(true);
    setNotice(null);
    await load();
    setRefreshing(false);
  }

  // Members only exist for a shared book, and only after we know which one.
  useEffect(() => {
    if (!current || current.ledger.kind !== "household") {
      setMembers([]);
      return;
    }
    let cancelled = false;
    authedApi
      .listLedgerMembers(current.ledger.id)
      .then((m) => {
        if (!cancelled) setMembers(m);
      })
      .catch(() => {
        // A members list that fails to load is not worth blocking the screen;
        // the book itself still works.
      });
    return () => {
      cancelled = true;
    };
  }, [current]);

  // --- switching -----------------------------------------------------------
  const [pendingSwitch, setPendingSwitch] = useState<Ledger | null>(null);
  const [switching, setSwitching] = useState(false);

  async function confirmSwitch() {
    const target = pendingSwitch;
    if (!target) return;
    setSwitching(true);
    setErr(null);
    try {
      await switchLedger(target.kind === "personal" ? null : target);
      setPendingSwitch(null);
      setNotice(s.books.switched(target.name));
      load();
    } catch (e) {
      setPendingSwitch(null);
      setErr(messageFor(e, s.books.switchFailed));
    } finally {
      setSwitching(false);
    }
  }

  // --- create --------------------------------------------------------------
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  async function createBook() {
    if (!newName.trim()) {
      setCreateErr(s.books.createSheet.noName);
      return;
    }
    setCreateBusy(true);
    setCreateErr(null);
    try {
      await authedApi.createLedger(newName.trim());
      setShowCreate(false);
      setNewName("");
      setNotice(s.books.created);
      load();
    } catch (e) {
      setCreateErr(messageFor(e, s.books.createFailed));
    } finally {
      setCreateBusy(false);
    }
  }

  // --- join ----------------------------------------------------------------
  const [showJoin, setShowJoin] = useState(false);
  const [code, setCode] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinErr, setJoinErr] = useState<string | null>(null);

  async function joinBook() {
    if (!code.trim()) {
      setJoinErr(s.books.joinSheet.noCode);
      return;
    }
    setJoinBusy(true);
    setJoinErr(null);
    try {
      const joined = await authedApi.joinLedger(code.trim());
      setShowJoin(false);
      setCode("");
      setNotice(s.books.joined(joined.name));
      load();
    } catch (e) {
      setJoinErr(messageFor(e, s.books.joinFailed));
    } finally {
      setJoinBusy(false);
    }
  }

  // --- invite --------------------------------------------------------------
  const [invite, setInvite] = useState<{ code: string; expires: string } | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  async function makeInvite() {
    if (!current || inviteBusy) return;
    setInviteBusy(true);
    setErr(null);
    try {
      const inv = await authedApi.createLedgerInvite(current.ledger.id);
      setInvite({ code: inv.code, expires: inv.expires_at });
    } catch (e) {
      setErr(messageFor(e, s.books.inviteFailed));
    } finally {
      setInviteBusy(false);
    }
  }

  // --- leave ---------------------------------------------------------------
  const [pendingLeave, setPendingLeave] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);

  async function confirmLeave() {
    if (!current || !user) return;
    const leaving = current.ledger.id;
    setLeaveBusy(true);
    try {
      // Move out before dropping the membership. The other order leaves the app
      // standing in a book the server now refuses, and the switch's own flush of
      // offline writes would be the first thing to fail.
      await switchLedger(null);
      await authedApi.removeLedgerMember(leaving, user.id);
      setPendingLeave(false);
      setNotice(s.books.left);
      load();
    } catch (e) {
      setPendingLeave(false);
      setErr(messageFor(e, s.books.leaveFailed));
    } finally {
      setLeaveBusy(false);
    }
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader
        title={s.books.title}
        backLabel={s.books.backLabel}
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
          <SectionLabel>{s.books.currentlyIn}</SectionLabel>
          <Text className="text-ink text-amount-lg font-mono-bold mt-1">
            {current?.ledger.name ?? s.books.personal}
          </Text>
          <Text className="text-faint text-caption font-sans-medium mt-1">
            {isShared ? s.books.sharedWithOthers(members.length) : s.books.privateToYou}
          </Text>
        </Card>

        {err && (
          <View className="mb-card-gap">
            <ErrorNotice message={err} onRetry={load} />
          </View>
        )}
        {notice && (
          <Card className="mb-card-gap">
            <Text className="text-dim text-body font-sans-medium">{notice}</Text>
          </Card>
        )}

        <SectionLabel>{s.books.yourBooks}</SectionLabel>
        <Card padded={false} className="mb-card-gap mt-2">
          {books.map((b, i) => (
            <ListRow
              key={b.ledger.id}
              title={b.ledger.name}
              subtitle={
                b.ledger.kind === "personal"
                  ? s.books.bookPersonal(b.ledger.base_currency)
                  : s.books.bookShared(b.ledger.base_currency, b.role)
              }
              glyph={b.ledger.kind === "personal" ? BookOpen : Users}
              divider={i > 0}
              trailing={
                b.ledger.id === current?.ledger.id ? <Badge>{s.books.current}</Badge> : undefined
              }
              onPress={
                b.ledger.id === current?.ledger.id
                  ? undefined
                  : () => setPendingSwitch(b.ledger)
              }
            />
          ))}
        </Card>

        {isShared && (
          <>
            <SectionLabel>{s.books.members}</SectionLabel>
            <Card padded={false} className="mb-card-gap mt-2">
              {members.map((m, i) => (
                <ListRow
                  key={m.user_id}
                  title={m.email}
                  subtitle={m.role === "owner" ? s.books.owner : s.books.member}
                  glyph={Users}
                  divider={i > 0}
                  trailing={m.user_id === user?.id ? <Badge>{s.books.you}</Badge> : undefined}
                />
              ))}
            </Card>

            <Card className="mb-card-gap">
              <SectionLabel>{s.books.invite}</SectionLabel>
              {invite ? (
                <>
                  <Text className="text-ink text-amount-lg font-mono-bold mt-2 tracking-widest">
                    {invite.code}
                  </Text>
                  <Text className="text-faint text-caption font-sans-medium mt-1">
                    {s.books.inviteHint(formatExpiry(invite.expires))}
                  </Text>
                </>
              ) : (
                <Text className="text-faint text-caption font-sans-medium mt-1">
                  {s.books.inviteReplaces}
                </Text>
              )}
              <View className="mt-3 self-start">
                <Button
                  label={
                    inviteBusy
                      ? s.books.creatingCode
                      : invite
                        ? s.books.newCode
                        : s.books.createCode
                  }
                  variant="tertiary"
                  fullWidth={false}
                  disabled={inviteBusy}
                  onPress={makeInvite}
                />
              </View>
            </Card>
          </>
        )}

        <View style={{ gap: 12 }}>
          <Button label={s.books.createShared} onPress={() => setShowCreate(true)} />
          <Button
            label={s.books.joinWithCode}
            variant="secondary"
            onPress={() => setShowJoin(true)}
          />
          {isShared && (
            <Button
              label={s.books.leaveBook}
              variant="tertiary"
              onPress={() => setPendingLeave(true)}
            />
          )}
        </View>
      </ScrollView>

      <Sheet
        visible={showCreate}
        title={s.books.createSheet.title}
        onClose={() => setShowCreate(false)}
      >
        <Field
          label={s.books.createSheet.name}
          value={newName}
          onChange={setNewName}
          placeholder={s.books.createSheet.namePlaceholder}
        />
        <Text className="text-faint text-caption font-sans-medium mt-2">
          {s.books.createSheet.hint}
        </Text>
        {createErr && (
          <Text
            className="text-error text-body font-sans-medium mt-3"
            accessibilityLiveRegion="polite"
            role="alert"
          >
            {createErr}
          </Text>
        )}
        <View className="mt-4">
          <Button label={s.common.create} busy={createBusy} onPress={createBook} />
        </View>
      </Sheet>

      <Sheet visible={showJoin} title={s.books.joinSheet.title} onClose={() => setShowJoin(false)}>
        <Field
          label={s.books.joinSheet.code}
          value={code}
          onChange={setCode}
          placeholder={s.books.joinSheet.codePlaceholder}
          autoCap="characters"
        />
        {joinErr && (
          <Text
            className="text-error text-body font-sans-medium mt-3"
            accessibilityLiveRegion="polite"
            role="alert"
          >
            {joinErr}
          </Text>
        )}
        <View className="mt-4">
          <Button label={s.books.joinSheet.submit} busy={joinBusy} onPress={joinBook} />
        </View>
      </Sheet>

      <Dialog
        visible={pendingSwitch !== null}
        title={s.books.confirmSwitch.title(pendingSwitch?.name ?? "")}
        body={s.books.confirmSwitch.body}
        confirmLabel={s.books.confirmSwitch.confirm}
        busy={switching}
        onConfirm={confirmSwitch}
        onCancel={() => setPendingSwitch(null)}
      />

      <Dialog
        visible={pendingLeave}
        title={s.books.confirmLeave.title}
        body={
          members.length > 1 ? s.books.confirmLeave.bodyOthers : s.books.confirmLeave.bodyLast
        }
        confirmLabel={s.books.confirmLeave.confirm}
        busy={leaveBusy}
        onConfirm={confirmLeave}
        onCancel={() => setPendingLeave(false)}
      />
    </SafeAreaView>
  );
}
