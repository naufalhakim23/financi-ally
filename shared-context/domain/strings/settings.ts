export const settings = {
  wording: {
    title: "How it is worded",
    backLabel: "More",
    normal: "Normal",
    finance: "Finance",
    explainer:
      "Same data, same screens — only the words change, plus one extra line on each entry. Switch back any time.",
    columnNormal: "normal",
    columnFinance: "finance",
    showSides: "Show the two sides on entries",
    showSidesHelper: "the debit and credit behind each move",
    preview: "preview · tab bar",
  },

  appearance: {
    title: "Appearance",
    backLabel: "More",
    system: "System",
    light: "Light",
    dark: "Dark",
    followingPhone: (current: string) => `Following your phone, which is currently ${current}.`,
    alwaysSet: (preference: string) => `Always ${preference}, whatever your phone is set to.`,
    currentDark: "dark",
    currentLight: "light",

    preview: "preview",
    previewTotal: "total money · IDR",
    previewGroceries: "Groceries",
    previewSalary: "Salary",
  },
};
