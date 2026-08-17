// The status strip above the tab bar.

export const sync = {
  rejected: (n: number) =>
    `${n} ${n === 1 ? "entry was" : "entries were"} rejected. Review and re-enter`,
  offline: "Offline. Everything you log is saved on this device",
  unreachable: "Couldn't reach the server. It'll retry on the next sync",
  view: "view",
  showEntries: (message: string) => `${message}. Show the entries`,
};
