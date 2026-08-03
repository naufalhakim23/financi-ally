import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authedApi } from "@/lib/api";
import { setActiveLedger, useActiveLedger } from "@/lib/ledger-store";
import { qk } from "@/lib/query";
import { cn } from "@/lib/utils";

/**
 * Switch the active book.
 *
 * On the web this is genuinely cheap: nothing is stored locally, so switching
 * is a header change plus a cache clear. (On mobile the same action wipes and
 * re-pulls a local database.) The cache clear is not optional — every money key
 * is namespaced by book, but clearing removes any chance of a stale figure from
 * the previous book surviving on screen for a frame.
 */
export function BookSwitcher() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const active = useActiveLedger();

  const { data: ledgers } = useQuery({
    queryKey: qk.ledgers,
    queryFn: () => authedApi.listLedgers(),
  });

  const current = ledgers?.find((l) => l.ledger.id === active)?.ledger ?? null;
  const label = current?.name ?? ledgers?.find((l) => l.ledger.kind === "personal")?.ledger.name;

  function choose(id: string | null) {
    if (id === active) return;
    setActiveLedger(id);
    queryClient.clear();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-1.5 px-2">
          <span className="text-body-strong truncate">{label ?? "Personal book"}</span>
          <ChevronsUpDown className="text-faint size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {ledgers?.map(({ ledger, role }) => (
          <DropdownMenuItem
            key={ledger.id}
            onSelect={() => choose(ledger.kind === "personal" ? null : ledger.id)}
            className="gap-2"
          >
            <Check
              className={cn(
                "size-3.5",
                ledger.id === active || (ledger.kind === "personal" && !active)
                  ? "opacity-100"
                  : "opacity-0",
              )}
            />
            <span className="flex-1 truncate">{ledger.name}</span>
            <span className="text-caption text-faint">{role}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/app/books")} className="gap-2">
          <Plus className="size-3.5" />
          Manage books
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
