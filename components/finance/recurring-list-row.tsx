"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";

import {
  formatFrequency,
  formatRecurringDate,
  getTransactionTypeMeta,
  type RecurringRow,
} from "@/lib/recurring";
import {
  deleteRecurring,
  generateNow,
  setRecurringActive,
  type ActionResult,
} from "@/app/(app)/recurring/actions";
import { AmountText } from "@/components/finance/amount-text";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface RecurringRowView extends RecurringRow {
  accountName: string | null;
  destinationAccountName: string | null;
  categoryName: string | null;
}

interface RecurringListRowProps {
  template: RecurringRowView;
  onError: (message: string) => void;
}

export function RecurringListRow({
  template,
  onError,
}: RecurringListRowProps) {
  const [isPending, startTransition] = useTransition();
  const meta = getTransactionTypeMeta(template.transaction_type);
  const Icon = meta.icon;
  const isTransfer = template.transaction_type === "transfer";
  const isExpense = template.transaction_type === "expense";
  const isIncome = template.transaction_type === "income";

  // Amount meaning is carried by sign and tone together, never color alone:
  // income shows "+Rp", expense shows "-Rp", transfer stays neutral.
  const amountValue = isExpense ? -template.amount : template.amount;
  const amountTone = isIncome ? "income" : isExpense ? "expense" : "default";

  // Quiet metadata line: type label, cadence, account(s), category, due date,
  // and status. Status is spelled out as text so it never relies on color.
  const metaParts: string[] = [
    meta.label,
    formatFrequency(template.frequency, template.interval_count),
  ];
  if (!isTransfer && template.categoryName) {
    metaParts.push(template.categoryName);
  }

  function run(label: string, fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) onError(result.message);
    });
  }

  function handleToggleActive() {
    run("toggle", () => setRecurringActive(template.id, !template.is_active));
  }

  function handleGenerate() {
    run("generate", () => generateNow(template.id));
  }

  function handleDelete() {
    const confirmed = window.confirm(
      `Hapus "${template.name}"? Transaksi yang sudah tercatat sebelumnya tetap tersimpan.`,
    );
    if (!confirmed) return;
    run("delete", () => deleteRecurring(template.id));
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{template.name}</span>

        {isTransfer ? (
          <span className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
            <span className="shrink-0">{meta.label}</span>
            <span className="shrink-0">{" · "}</span>
            <span className="truncate">
              {template.accountName ?? "Rekening"}
            </span>
            <ArrowRight className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {template.destinationAccountName ?? "Rekening"}
            </span>
          </span>
        ) : (
          <span className="truncate text-sm text-muted-foreground">
            {metaParts.join(" · ")}
          </span>
        )}

        <span className="truncate text-sm text-muted-foreground">
          Jatuh tempo berikutnya {formatRecurringDate(template.next_due_date)}
          {" · "}
          {template.is_active ? "Aktif" : "Jeda"}
        </span>
      </div>

      <AmountText
        value={amountValue}
        tone={amountTone}
        size="sm"
        signed={!isTransfer}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label={`Aksi untuk ${template.name}`}
            disabled={isPending}
          >
            <MoreVertical className="size-5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {template.is_active ? (
            <DropdownMenuItem onSelect={handleGenerate}>
              <Plus aria-hidden />
              Catat sekarang
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={`/recurring/${template.id}/edit`}>
              <Pencil aria-hidden />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleToggleActive}>
            {template.is_active ? (
              <>
                <Pause aria-hidden />
                Jeda
              </>
            ) : (
              <>
                <Play aria-hidden />
                Lanjutkan
              </>
            )}
          </DropdownMenuItem>
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
