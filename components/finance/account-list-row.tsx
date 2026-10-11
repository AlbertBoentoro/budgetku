"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Archive, MoreVertical, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getAccountTypeMeta,
  type AccountAccent,
  type AccountRow,
} from "@/lib/accounts";
import {
  deleteAccount,
  setAccountArchived,
  type ActionResult,
} from "@/app/(app)/accounts/actions";
import { AmountText } from "@/components/finance/amount-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Icon-only accent, matching the dashboard AccountCard treatment. The colorful
// account tokens appear only on this icon, never as a full-color card.
const accentIconClasses: Record<AccountAccent, string> = {
  blue: "text-account-blue",
  violet: "text-account-violet",
  emerald: "text-account-emerald",
  amber: "text-account-amber",
  rose: "text-account-rose",
  slate: "text-account-slate",
};

interface AccountListRowProps {
  account: AccountRow;
  // Transaction-derived running balance (initial_balance + net), computed
  // server-side; shown in place of the raw initial_balance.
  balance: number;
  onError: (message: string) => void;
}

export function AccountListRow({
  account,
  balance,
  onError,
}: AccountListRowProps) {
  const [isPending, startTransition] = useTransition();
  const meta = getAccountTypeMeta(account.account_type);
  const Icon = meta.icon;
  const archived = account.is_archived;

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
    // server re-checks references and refuses if the account is still used.
    const confirmed = window.confirm(
      `Hapus rekening "${account.name}"? Tindakan ini tidak bisa dibatalkan.`,
    );
    if (!confirmed) return;
    run(() => deleteAccount(account.id));
  }

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        archived && "opacity-70",
      )}
    >
      <Icon
        className={cn("size-5 shrink-0", accentIconClasses[meta.accent])}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{account.name}</span>
          {archived ? (
            <Badge variant="secondary" className="shrink-0">
              Diarsipkan
            </Badge>
          ) : null}
        </div>
        <span className="text-sm text-muted-foreground">{meta.label}</span>
      </div>

      <AmountText value={balance} size="sm" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label={`Aksi untuk ${account.name}`}
            disabled={isPending}
          >
            <MoreVertical className="size-5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/accounts/${account.id}/edit`}>
              <Pencil aria-hidden />
              Edit
            </Link>
          </DropdownMenuItem>
          {archived ? (
            <DropdownMenuItem
              onSelect={() => run(() => setAccountArchived(account.id, false))}
            >
              <RotateCcw aria-hidden />
              Pulihkan
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() => run(() => setAccountArchived(account.id, true))}
            >
              <Archive aria-hidden />
              Arsipkan
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={handleDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 aria-hidden />
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
