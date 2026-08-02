import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { currencyError, emailError, passwordError } from "@financially/domain/validate";

import { Field } from "@/components/field";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { HTTPError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AuthShell } from "@/routes/auth-shell";

export function RegisterRoute() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currency, setCurrency] = useState("");
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailErr = touched ? emailError(email) : null;
  const passwordErr = touched ? passwordError(password) : null;
  const currencyErr = touched ? currencyError(currency, { required: false }) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setFailure(null);
    if (
      emailError(email) ||
      passwordError(password) ||
      currencyError(currency, { required: false })
    ) {
      return;
    }

    setBusy(true);
    try {
      await signUp(email.trim(), password, currency.trim().toUpperCase() || undefined);
      navigate("/app", { replace: true });
    } catch (err) {
      setFailure(
        err instanceof HTTPError && err.status === 409
          ? "That email is already registered. Try signing in."
          : "Couldn't create your account. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="One book to start; add more whenever you like."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-info-strong font-semibold hover:underline">
            Sign in
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
          autoComplete="new-password"
          value={password}
          error={passwordErr}
          hint="at least 8 characters"
          onChange={(e) => setPassword(e.target.value)}
        />
        <Field
          label="Base currency"
          value={currency}
          error={currencyErr}
          hint="optional — defaults to IDR"
          placeholder="IDR"
          maxLength={3}
          onChange={(e) => setCurrency(e.target.value)}
        />

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
