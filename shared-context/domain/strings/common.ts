// Words that belong to no one screen: the verbs on buttons, the shared units,
// the placeholder every dash-for-missing-value renders.

export const common = {
  save: "Save",
  cancel: "Cancel",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  back: "Back",
  done: "Done",
  skip: "Skip",
  continue: "Continue",
  finish: "Finish",
  tryAgain: "Try again",
  new: "New",
  add: "Add",
  clear: "Clear",
  any: "Any",
  search: "Search",
  filter: "Filter",
  missing: "—",
  /** The Home tab. Named here because both the tab bar and its preview need it. */
  home: "Home",
  entries: (n: number) => (n === 1 ? "entry" : "entries"),
  months: (n: number) => (n === 1 ? "month" : "months"),
  personalSpace: "Personal",
};
