export const more = {
  title: "More",
  lockedSubtitle: "Sign in to unlock",

  books: "Books",
  booksShared: (name: string) => `${name} · shared`,
  booksPersonal: "Personal · private to you",

  wording: "How it is worded",
  wordingFinance: "Finance",
  wordingNormal: "Normal",

  appearance: "Appearance",
  appearanceSystem: "Follows your phone",
  appearanceDark: "Dark",
  appearanceLight: "Light",

  plan: "The spending plan",
  planSubtitle: "Set what each category may take",

  repeating: "Repeating entries",
  repeatingSubtitle: "Rent, salary, subscriptions",

  reports: "Reports",
  reportsSubtitle: "Cash flow and category breakdown",

  sectionMoney: "your money",
  sectionApp: "this app",

  thisDevice: "this device",

  guest: {
    title: "Everything is on this phone",
    body: "Nothing has left the device. Make an account and what you have entered comes with you — plus reports, the spending plan and shared books.",
    createAccount: "Create an account",
    haveAccount: "I already have an account",
  },

  sync: "Sync",
  signedIn: "signed in",
  pending: "pending",
  syncing: "Syncing…",
  syncNow: "Sync now",
  signOut: "Sign out",
  // Signing out is the one action here that can strand money on the device.
  confirmSignOut: {
    title: "Sign out?",
    pending: "This device still has entries that have not reached the server. Sync first, or they stay on this phone.",
    synced: "Everything is synced. You can sign back in on any device.",
    stay: "Stay signed in",
  },
};
