"use client";

import { useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BudgetItemView } from "@/lib/budgets";
import {
  deleteBudgetItem,
  type ActionResult,
} from "@/app/(app)/budget/actions";
import { AmountText } from "@/components/finance/amount-text";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BudgetItemRowProps {
  item: BudgetItemView;
  monthParam: string;
  onError: (message: string) => void;
}

export function BudgetItemRow({ item, monthParam, onError }: BudgetItemRowProps) {
  const [isPending, startTransition] = useTransition();
  const { usage } = item;
  const label = item.categoryName ?? "Kategori";

  function handleDelete() {
    const confirmed = window.confirm(
      `Hapus batas untuk "${label}"? Tindakan ini tidak bisa dibatalkan.`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result: ActionResult = await deleteBudgetItem(item.id);
      if (!result.ok) {
        onError(result.message);
      }
    });
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{label}</span>
            {item.is_fixed ? (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Tetap
              </span>
            ) : null}
          </div>
          {/* Real numbers always accompany the bar — never color alone. */}
          <span className="text-sm text-muted-foreground tabular-nums">
            Terpakai <AmountText value={usage.spent} size="sm" /> /{" "}
            <AmountText value={usage.planned} size="sm" />
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              aria-label={`Aksi untuk ${label}`}
              disabled={isPending}
            >
              <MoreVertical className="size-5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/budget/items/${item.id}/edit?month=${monthParam}`}>
                <Pencil aria-hidden />
                Edit
              </Link>
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
      </div>

      {/* Secondary usage bar. Width reflects the ratio but is purely visual;
          the meaning lives in the text above and the over/remaining line
          below, so it never conveys status by color alone. */}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        aria-hidden
      >
        <div
          className={cn(
            "h-full rounded-full",
            usage.isOverBudget ? "bg-expense" : "bg-primary",
          )}
          style={{ width: `${usage.barPercent}%` }}
        />
      </div>

      {usage.isOverBudget ? (
        <span className="flex items-center gap-1.5 text-sm text-expense">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Melebihi anggaran{" "}
          <AmountText
            value={-usage.remaining}
            size="sm"
            tone="expense"
          />
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">
          Sisa <AmountText value={usage.remaining} size="sm" />
        </span>
      )}
    </li>
  );
}
