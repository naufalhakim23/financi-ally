import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { emailError, passwordError, resetCodeError } from "@financially/domain/validate";

import { Field } from "@/components/field";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { api, HTTPError } from "@/lib/api";
import { AuthShell } from "@/routes/auth-shell";

export function ResetPasswordRoute() {
  const [params] = useSearchParams();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setFailure(null);
    if (emailError(email) || resetCodeError(code) || passwordError(password)) return;

    setBusy(true);
    try {
      await api.resetPassword(email.trim(), code.trim(), password);
      // A reset signs you in on this device: the server has already revoked
      // every other session, so leaving the user at a login form would just be
      // one more password prompt. The response sets the refresh cookie, so a
      // full load re-enters through the normal boot path rather than threading
      // a session through router state.
      window.location.assign("/app");
    } catch (err) {
      setFailure(
        err instanceof HTTPError && (err.status === 400 || err.status === 401)
          ? "That code is wrong or has expired. Request a new one."
          : "Couldn't reset your password. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Enter your code"
      subtitle="If that address has an account, a code is on its way."
      footer={
        <Link to="/forgot-password" className="text-info-strong font-semibold hover:underline">
          Send a new code
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {failure ? <ErrorState message={failure} /> : null}
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          error={touched ? emailError(email) : null}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          error={touched ? resetCodeError(code) : null}
          onChange={(e) => setCode(e.target.value)}
          className="tabular"
        />
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          error={touched ? passwordError(password) : null}
          hint="at least 8 characters"
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Set new password"}
        </Button>
      </form>
    </AuthShell>
  );
}
