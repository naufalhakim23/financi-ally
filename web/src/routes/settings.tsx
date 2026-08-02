import { LogOut } from "lucide-react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useTheme, type ThemePref } from "@/lib/theme";
import { TERM_ROWS, useWording } from "@/lib/wording";
import { cn } from "@/lib/utils";

const THEMES: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="bg-surface-container inline-flex rounded-md p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "text-label rounded-[6px] px-3 py-1.5 transition-colors",
            "focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none",
            value === o.value ? "bg-surface text-ink shadow-card font-semibold" : "text-dim",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsRoute() {
  const { user, signOut } = useAuth();
  const { pref, setPref } = useTheme();
  const { mode, setMode, showSides, setShowSides } = useWording();
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-title text-ink font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-headline">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-caption text-faint">Signed in as</p>
            <p className="text-body text-ink">{user?.email}</p>
          </div>
          <div>
            <p className="text-caption text-faint">Base currency</p>
            <p className="text-body text-ink tabular font-mono">{user?.base_currency}</p>
          </div>
          <Button variant="outline" onClick={onSignOut} className="gap-2">
            <LogOut className="size-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-headline">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <Segmented value={pref} options={THEMES} onChange={setPref} label="Appearance" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-headline">Wording</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-body text-dim">
            Same data, same screens — only the vocabulary changes. Double-entry is a mode here, not
            a default.
          </p>
          <Segmented
            value={mode}
            options={[
              { value: "normal", label: "Plain" },
              { value: "finance", label: "Finance" },
            ]}
            onChange={setMode}
            label="Wording"
          />

          <div className="border-outline overflow-hidden rounded-lg border">
            <table className="w-full text-left">
              <thead className="bg-surface-container">
                <tr className="text-caption text-faint">
                  <th className="px-3 py-2 font-medium">Plain</th>
                  <th className="px-3 py-2 font-medium">Finance</th>
                </tr>
              </thead>
              <tbody>
                {TERM_ROWS.map((row) => (
                  <tr key={row.key} className="border-outline-variant border-t">
                    <td
                      className={cn(
                        "text-body px-3 py-2",
                        mode === "normal" ? "text-ink font-semibold" : "text-dim",
                      )}
                    >
                      {row.normal}
                    </td>
                    <td
                      className={cn(
                        "text-body px-3 py-2",
                        mode === "finance" ? "text-ink font-semibold" : "text-dim",
                      )}
                    >
                      {row.finance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={showSides}
              onChange={(e) => setShowSides(e.target.checked)}
              className="accent-primary size-4"
            />
            <span className="text-body text-ink">Show debit and credit lines on entries</span>
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
