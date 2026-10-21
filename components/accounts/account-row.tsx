"use client";

import { useTransition } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { AccountAccent } from "@/lib/accounts";
import {
  deleteAccount,
  setAccountArchived,
  type ActionResult,
} from "@/app/(app)/accounts/actions";
import { AmountText } from "@/components/finance/amount-text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Serializable per-row view model built on the server. Keeping it a plain
// object (no Map, no lucide component) lets the page pass it straight into this
// client component.
export interface AccountRowView {
  id: string;
  name: string;
  typeLabel: string;
  glyph: string;
  accent: AccountAccent;
  balance: number;
  archived: boolean;
}

// Icon-only accent, matching the dashboard/account treatment. The colorful
// account tokens appear only on this glyph, never as a full-color row.
const accentIconClasses: Record<AccountAccent, string> = {
  blue: "text-account-blue",
  violet: "text-account-violet",
  emerald: "text-account-emerald",
  amber: "text-account-amber",
  rose: "text-account-rose",
  slate: "text-account-slate",
};

interface AccountRowProps {
  account: AccountRowView;
  // Shared live region on the manager surfaces a failed delete/archive.
  onError: (message: string) => void;
}

// Stitch ledger row for an account: an accent icon circle, a tappable label
// area linking to the edit screen, the real running balance (navy, red + minus
// when negative so meaning is not color alone), an honest status label, and an
// isolated actions menu wired to the existing server actions.
export function AccountRow({ account, onError }: AccountRowProps) {
  const [isPending, startTransition] = useTransition();
  const isNegative = account.balance < 0;

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        onError(result.message);
      }
    });
  }

  function handleDelete() {
    // Lightweight confirmation without pulling in a Dialog dependency. The
    // server re-checks references and refuses (suggesting archive) if the
    // account is still used.
    const confirmed = window.confirm(
      `Hapus rekening "${account.name}"? Tindakan ini tidak bisa dibatalkan.`,
    );
    if (!confirmed) return;
    run(() => deleteAccount(account.id));
  }

  return (
    <li className={cn("flex items-center gap-3 px-4 py-3", account.archived && "opacity-70")}>
      <Link
        href={`/accounts/${account.id}/edit`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container">
          <Icon
            name={account.glyph}
            size={20}
            className={accentIconClasses[account.accent]}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-md text-on-surface">
            {account.name}
          </span>
          <span className="truncate text-body-sm text-on-surface-variant">
            {account.typeLabel}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          {/* Size on the wrapper: tailwind-merge reads text-currency-body as a
              color, so passing it with a tone class dropped one of them. */}
          <span className="text-currency-body">
            <AmountText
              value={account.balance}
              size="none"
              tone={isNegative ? "expense" : "default"}
              className={cn(!isNegative && "text-on-surface")}
            />
          </span>
          <span className="text-label-xs text-on-surface-variant">
            {account.archived ? "Diarsipkan" : "Aktif"}
          </span>
        </span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 text-on-surface-variant"
            aria-label={`Aksi untuk ${account.name}`}
            disabled={isPending}
          >
            <Icon name="more_vert" size={20} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/accounts/${account.id}/edit`}>
              <Icon name="edit" size={18} />
              Edit
            </Link>
          </DropdownMenuItem>
          {account.archived ? (
            <DropdownMenuItem
              onSelect={() => run(() => setAccountArchived(account.id, false))}
            >
              <Icon name="unarchive" size={18} />
              Pulihkan
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() => run(() => setAccountArchived(account.id, true))}
            >
              <Icon name="archive" size={18} />
              Arsipkan
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={handleDelete}
            className="text-expense focus:text-expense"
          >
            <Icon name="delete" size={18} />
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
