import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import {
  authedApi,
  type Ledger,
  type LedgerMember,
  type LedgerMembership,
} from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { switchLedger } from "../../src/lib/ledgers";
import { useLedgerState } from "../../src/lib/ledgerStore";
import {
  Badge,
  BookOpen,
  Button,
  Card,
  Dialog,
  Field,
  ListRow,
  ScreenHeader,
  SectionLabel,
  Sheet,
  Users,
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

  const [books, setBooks] = useState<LedgerMembership[]>([]);
  const [members, setMembers] = useState<LedgerMember[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The active book, as the server describes it. Falls back to whichever
  // membership matches the stored id so the header is right before any fetch.
  const current =
    books.find((b) => b.ledger.id === (active?.id ?? "")) ??
    books.find((b) => b.ledger.kind === "personal");
  const isShared = current?.ledger.kind === "household";

  const load = useCallback(() => {
    setErr(null);
    authedApi
      .listLedgers()
      .then(setBooks)
      .catch((e) => setErr(e instanceof Error ? e.message : "couldn't load your books"));
  }, []);

  useEffect(load, [load, user]);

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
      setNotice(`Now in ${target.name}`);
      load();
    } catch (e) {
      setPendingSwitch(null);
      setErr(e instanceof Error ? e.message : "couldn't switch books");
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
      setCreateErr("Give the book a name");
      return;
    }
    setCreateBusy(true);
    setCreateErr(null);
    try {
      await authedApi.createLedger(newName.trim());
      setShowCreate(false);
      setNewName("");
      setNotice("Book created. Switch to it to start adding entries");
      load();
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "couldn't create the book");
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
      setJoinErr("Enter the code you were given");
      return;
    }
    setJoinBusy(true);
    setJoinErr(null);
    try {
      const joined = await authedApi.joinLedger(code.trim());
      setShowJoin(false);
      setCode("");
      setNotice(`Joined ${joined.name}. Switch to it to see the shared entries`);
      load();
    } catch (e) {
      setJoinErr(e instanceof Error ? e.message : "couldn't join with that code");
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
      setErr(e instanceof Error ? e.message : "couldn't create an invite code");
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
      setNotice("You left the book and are back in your personal one");
      load();
    } catch (e) {
      setPendingLeave(false);
      setErr(e instanceof Error ? e.message : "couldn't leave the book");
    } finally {
      setLeaveBusy(false);
    }
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="Books" backLabel="More" onBack={() => router.back()} />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Card className="mb-card-gap">
          <SectionLabel>Currently in</SectionLabel>
          <Text className="text-ink text-amount-lg font-mono-bold mt-1">
            {current?.ledger.name ?? "Personal"}
          </Text>
          <Text className="text-faint text-caption font-sans-medium mt-1">
            {isShared
              ? `shared · everything you add here is visible to ${members.length > 1 ? `${members.length - 1} other${members.length > 2 ? "s" : ""}` : "the other members"}`
              : "private to you"}
          </Text>
        </Card>

        {err && (
          <Card className="mb-card-gap">
            <Text className="text-error text-body font-sans-medium">{err}</Text>
          </Card>
        )}
        {notice && (
          <Card className="mb-card-gap">
            <Text className="text-dim text-body font-sans-medium">{notice}</Text>
          </Card>
        )}

        <SectionLabel>Your books</SectionLabel>
        <Card padded={false} className="mb-card-gap mt-2">
          {books.map((b, i) => (
            <ListRow
              key={b.ledger.id}
              title={b.ledger.name}
              subtitle={
                b.ledger.kind === "personal"
                  ? `private · ${b.ledger.base_currency}`
                  : `shared · ${b.ledger.base_currency} · ${b.role}`
              }
              glyph={b.ledger.kind === "personal" ? BookOpen : Users}
              divider={i > 0}
              trailing={
                b.ledger.id === current?.ledger.id ? <Badge>current</Badge> : undefined
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
            <SectionLabel>Members</SectionLabel>
            <Card padded={false} className="mb-card-gap mt-2">
              {members.map((m, i) => (
                <ListRow
                  key={m.user_id}
                  title={m.email}
                  subtitle={m.role === "owner" ? "owner" : "member"}
                  glyph={Users}
                  divider={i > 0}
                  trailing={m.user_id === user?.id ? <Badge>you</Badge> : undefined}
                />
              ))}
            </Card>

            <Card className="mb-card-gap">
              <SectionLabel>Invite someone</SectionLabel>
              {invite ? (
                <>
                  <Text className="text-ink text-amount-lg font-mono-bold mt-2 tracking-widest">
                    {invite.code}
                  </Text>
                  <Text className="text-faint text-caption font-sans-medium mt-1">
                    they enter this under Books → Join · expires {formatExpiry(invite.expires)}
                  </Text>
                </>
              ) : (
                <Text className="text-faint text-caption font-sans-medium mt-1">
                  a new code replaces any code you shared before
                </Text>
              )}
              <View className="mt-3 self-start">
                <Button
                  label={inviteBusy ? "Creating…" : invite ? "New code" : "Create a code"}
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
          <Button label="Create a shared book" onPress={() => setShowCreate(true)} />
          <Button label="Join with a code" variant="secondary" onPress={() => setShowJoin(true)} />
          {isShared && (
            <Button label="Leave this book" variant="tertiary" onPress={() => setPendingLeave(true)} />
          )}
        </View>
      </ScrollView>

      <Sheet visible={showCreate} title="New shared book" onClose={() => setShowCreate(false)}>
        <Field label="Name" value={newName} onChange={setNewName} placeholder="Rumah" />
        <Text className="text-faint text-caption font-sans-medium mt-2">
          It starts empty. Add its pockets and categories after you switch to it: a shared book
          keeps its own accounts, separate from your personal ones.
        </Text>
        {createErr && (
          <Text className="text-error text-body font-sans-medium mt-3">{createErr}</Text>
        )}
        <View className="mt-4">
          <Button label="Create" busy={createBusy} onPress={createBook} />
        </View>
      </Sheet>

      <Sheet visible={showJoin} title="Join a book" onClose={() => setShowJoin(false)}>
        <Field
          label="Code"
          value={code}
          onChange={setCode}
          placeholder="K7M2QX9B"
          autoCap="characters"
        />
        {joinErr && <Text className="text-error text-body font-sans-medium mt-3">{joinErr}</Text>}
        <View className="mt-4">
          <Button label="Join" busy={joinBusy} onPress={joinBook} />
        </View>
      </Sheet>

      <Dialog
        visible={pendingSwitch !== null}
        title={`Switch to ${pendingSwitch?.name ?? ""}?`}
        body="This device will re-download that book's entries. Anything you added offline is sent first, so nothing is lost."
        confirmLabel="Switch"
        busy={switching}
        onConfirm={confirmSwitch}
        onCancel={() => setPendingSwitch(null)}
      />

      <Dialog
        visible={pendingLeave}
        title="Leave this book?"
        body={
          members.length > 1
            ? "You'll stop seeing its entries on this device. The book and its history stay with the other members."
            : "You're the only one left, so the book closes when you go. Its history goes with it."
        }
        confirmLabel="Leave"
        busy={leaveBusy}
        onConfirm={confirmLeave}
        onCancel={() => setPendingLeave(false)}
      />
    </SafeAreaView>
  );
}
