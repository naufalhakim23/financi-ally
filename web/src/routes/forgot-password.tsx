import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { emailError } from "@financially/domain/validate";

import { Field } from "@/components/field";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { AuthShell } from "@/routes/auth-shell";

export function ForgotPasswordRoute() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setFailure(null);
    if (emailError(email)) return;

    setBusy(true);
    try {
      await api.forgotPassword(email.trim());
      // The server answers 204 whether or not the address is registered, and so
      // must this screen: confirming an account exists here would make an
      // unauthenticated endpoint an enumeration oracle.
      navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`);
    } catch {
      setFailure("Couldn't send the code. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a six-digit code."
      footer={
        <Link to="/login" className="text-info-strong font-semibold hover:underline">
          Back to sign in
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
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Sending…" : "Send code"}
        </Button>
      </form>
    </AuthShell>
  );
}
