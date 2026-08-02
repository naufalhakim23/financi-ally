import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { emailError, passwordError } from "@financially/domain/validate";

import { Field } from "@/components/field";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { HTTPError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AuthShell } from "@/routes/auth-shell";

export function LoginRoute() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Field errors only surface after a submit attempt: telling someone their
  // half-typed address is invalid is noise, not help.
  const emailErr = touched ? emailError(email) : null;
  const passwordErr = touched ? passwordError(password) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setFailure(null);
    if (emailError(email) || passwordError(password)) return;

    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate("/app", { replace: true });
    } catch (err) {
      // 401 here means "wrong email or password" and must stay ambiguous about
      // which — naming the wrong one turns this into an account-enumeration
      // oracle.
      setFailure(
        err instanceof HTTPError && err.status === 401
          ? "That email and password don't match."
          : "Couldn't sign in. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your books."
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="text-info-strong font-semibold hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {failure ? <ErrorState message={failure} /> : null}

        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          error={emailErr}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          error={passwordErr}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-caption text-dim hover:underline">
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
