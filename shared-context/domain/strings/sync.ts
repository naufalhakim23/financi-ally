// The status strip above the tab bar. It is the one place the app volunteers
// bad news, so it says what happened and what it means for the user's money,
// never what the transport did.

export const sync = {
  rejected: (n: number) =>
    `${n} ${n === 1 ? "entry was" : "entries were"} rejected. Review and re-enter`,
  offline: "Offline. Everything you log is saved on this device",
  unreachable: "Couldn't reach the server. It'll retry on the next sync",
  view: "view",
  showEntries: (message: string) => `${message}. Show the entries`,
};
