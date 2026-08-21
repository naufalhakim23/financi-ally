export const auth = {
  wordmark: "Financi-Ally",
  back: "Back",
  or: "or",
  emailLabel: "Email",
  emailPlaceholder: "you@example.com",

  welcome: {
    caption: "Track your money on this device. No account needed.",
    footer:
      "Everything stays on this device until you make an account. Create one later and what you have entered comes with you.",
    currencyLabel: "What currency do you count in?",
    start: "Start tracking",
    haveAccount: "I already have an account",
    failed: "Couldn't start",
  },

  login: {
    caption: "Sign in to your account",
    passwordLabel: "Password",
    passwordPlaceholder: "Your password",
    noPassword: "Enter your password",
    forgot: "Forgot password?",
    submit: "Sign in",
    google: "Continue with Google",
    toRegister: "No account? Create one",
    failed: "Sign in failed",
    googleFailed: "Google sign-in failed",
  },

  register: {
    caption: "Create your account",
    passwordLabel: "Password",
    passwordPlaceholder: (min: number) => `At least ${min} characters`,
    passwordHelper: (min: number) => `${min} characters minimum`,
    currencyLabel: "Base currency",
    currencyInherited: "Carried over from what you've already recorded on this device",
    currencyHelper: "Everything is reported in this currency. Leave blank for IDR.",
    submit: "Create account",
    google: "Continue with Google",
    googleNote: "Google accounts skip the password. You can add one later from Forgot password.",
    toLogin: "Already have an account? Sign in",
    failed: "Registration failed",
    googleFailed: "Google sign-up failed",
  },

  forgot: {
    caption: "Reset your password",
    step: "step 1 of 2",
    emailHelper: "We'll send a 6-digit code to this address",
    submit: "Send the code",
    haveCode: "I already have a code",
    failed: "Couldn't send the code",
  },

  reset: {
    caption: "Enter your code",
    step: "step 2 of 2",
    codeLabel: "Code",
    codePlaceholder: "123456",
    codeHelper: "The 6-digit code we emailed you. It expires in 15 minutes.",
    codeResent: "A new code is on its way — the previous one no longer works",
    passwordLabel: "New password",
    passwordPlaceholder: (min: number) => `At least ${min} characters`,
    submit: "Set new password",
    resend: "Send a new code",
    signsYouOut: "Setting a new password signs you out everywhere else.",
    failed: "Couldn't reset your password",
    resendFailed: "Couldn't send a new code",
  },

  merge: {
    title: "Entries on this device",
    body: (count: number, label: string) =>
      `You recorded ${count} ${count === 1 ? "entry" : "entries"} without an account. Keep them and they move into ${label}.`,
    fallbackLabel: "your account",
    keep: "Keep them",
    discard: "Start fresh",
  },
};
