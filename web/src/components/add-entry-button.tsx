import { Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { useWording } from "@/lib/wording";

/**
 * Open the add-entry dialog over the current screen.
 *
 * `state.background` is what keeps the ledger rendered underneath (see
 * App.tsx). Putting it in one component rather than at each call site means a
 * new "add entry" button can't accidentally blank the page behind it.
 */
export function AddEntryButton({ size }: { size?: "sm" | "default" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useWording();

  return (
    <Button
      size={size}
      onClick={() => navigate("/app/entry/new", { state: { background: location } })}
      className="gap-1.5"
    >
      <Plus className="size-4" />
      {t("addEntry")}
    </Button>
  );
}
