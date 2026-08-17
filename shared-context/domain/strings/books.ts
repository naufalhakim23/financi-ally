export const books = {
  title: "Books",
  backLabel: "More",
  personal: "Personal",

  loadFailed: "Couldn't load your books. Pull down to try again",
  switchFailed: "Couldn't switch books. Try again",
  createFailed: "That book didn't save. Try again",
  joinFailed: "That code didn't work. Check it and try again",
  inviteFailed: "Couldn't make a code just now. Try again",
  leaveFailed: "Couldn't leave the book. Try again",

  currentlyIn: "Currently in",
  sharedWithOthers: (n: number) =>
    n > 1
      ? `shared · everything you add here is visible to ${n - 1} other${n > 2 ? "s" : ""}`
      : "shared · everything you add here is visible to the other members",
  privateToYou: "private to you",

  yourBooks: "Your books",
  bookPersonal: (currency: string) => `private · ${currency}`,
  bookShared: (currency: string, role: string) => `shared · ${currency} · ${role}`,
  current: "current",

  members: "Members",
  owner: "owner",
  member: "member",
  you: "you",

  invite: "Invite someone",
  inviteHint: (expires: string) => `they enter this under Books → Join · expires ${expires}`,
  inviteReplaces: "a new code replaces any code you shared before",
  creatingCode: "Creating…",
  newCode: "New code",
  createCode: "Create a code",

  createShared: "Create a shared book",
  joinWithCode: "Join with a code",
  leaveBook: "Leave this book",

  createSheet: {
    title: "New shared book",
    name: "Name",
    namePlaceholder: "Rumah",
    hint: "It starts empty. Add its pockets and categories after you switch to it: a shared book keeps its own accounts, separate from your personal ones.",
    noName: "Give the book a name",
  },
  created: "Book created. Switch to it to start adding entries",

  joinSheet: {
    title: "Join a book",
    code: "Code",
    codePlaceholder: "K7M2QX9B",
    noCode: "Enter the code you were given",
    submit: "Join",
  },
  joined: (name: string) => `Joined ${name}. Switch to it to see the shared entries`,
  switched: (name: string) => `Now in ${name}`,
  left: "You left the book and are back in your personal one",

  confirmSwitch: {
    title: (name: string) => `Switch to ${name}?`,
    body: "This device will re-download that book's entries. Anything you added offline is sent first, so nothing is lost.",
    confirm: "Switch",
  },

  confirmLeave: {
    title: "Leave this book?",
    bodyOthers:
      "You'll stop seeing its entries on this device. The book and its history stay with the other members.",
    bodyLast: "You're the only one left, so the book closes when you go. Its history goes with it.",
    confirm: "Leave",
  },
};
