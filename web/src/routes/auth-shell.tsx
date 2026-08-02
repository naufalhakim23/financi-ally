import type { ReactNode } from "react";
import { Link } from "react-router";

// One frame for every unauthenticated screen: centered card, brand above,
// supporting link below. Keeping it here means the four auth routes differ only
// in their fields, which is the only thing that should differ.
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 block text-center">
          <span className="text-headline text-ink font-semibold">Financi-Ally</span>
        </Link>

        <div className="bg-surface border-outline shadow-card rounded-xl border p-6">
          <h1 className="text-title text-ink font-bold">{title}</h1>
          {subtitle ? <p className="text-body text-dim mt-1">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>

        {footer ? <div className="text-body text-dim mt-6 text-center">{footer}</div> : null}
      </div>
    </div>
  );
}
