"use client";

import { useTransition } from "react";
import Link from "next/link";

import type { BudgetItemView } from "@/lib/budgets";
import {
  deleteBudgetItem,
  type ActionResult,
} from "@/app/(app)/budget/actions";
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

interface BudgetItemRowProps {
  item: BudgetItemView;
  monthParam: string;
  onError: (message: string) => void;
}

// Near-budget threshold: flag "Mendekati batas" once real usage reaches 90% of
// the plan and is not yet over. Presentation constant, not money logic.
const NEAR_BUDGET_RATIO = 0.9;

export function BudgetItemRow({ item, monthParam, onError }: BudgetItemRowProps) {
  const [isPending, startTransition] = useTransition();
  const { usage } = item;
  const label = item.categoryName ?? "Kategori";
  const pct = Math.round(usage.barPercent);
  const isNear = !usage.isOverBudget && usage.ratio >= NEAR_BUDGET_RATIO;

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
    <li className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5">
      <div className="flex items-start gap-3">
        <Link
          href={`/budget/items/${item.id}/edit?month=${monthParam}`}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* One neutral glyph for every category: the stored category icon is
              unvalidated and no name->glyph map exists, so a per-category icon
              would be fabricated. */}
          <span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container">
            <Icon name="category" size={20} className="text-on-surface-variant" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="break-words text-body-md text-on-surface">
                {label}
              </span>
              {item.is_fixed ? (
                <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 text-label-xs text-on-surface-variant">
                  Tetap
                </span>
              ) : null}
            </span>
          </span>
        </Link>

        <span className="flex shrink-0 flex-col items-end">
          <AmountText
            value={usage.spent}
            size="none"
            className="text-currency-body text-on-surface"
          />
          <span className="text-label-xs text-on-surface-variant">
            Terpakai
          </span>
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 text-on-surface-variant"
              aria-label={`Aksi untuk ${label}`}
              disabled={isPending}
            >
              <Icon name="more_vert" size={20} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/budget/items/${item.id}/edit?month=${monthParam}`}>
                <Icon name="edit" size={18} />
                Edit
              </Link>
            </DropdownMenuItem>
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
      </div>

      <div className="flex items-center justify-between gap-3 text-label-md text-on-surface-variant">
        <span className="min-w-0">
          Batas{" "}
          <AmountText
            value={usage.planned}
            size="none"
            className="text-label-md"
          />
        </span>
        <span className="shrink-0">
          Sisa{" "}
          <AmountText
            value={usage.remaining}
            size="none"
            tone={usage.isOverBudget ? "expense" : "default"}
            className="text-label-md"
          />
        </span>
      </div>

      {/* Usage bar width reflects the real ratio; status is also named in text
          + icon below so meaning is never carried by the bar color alone. */}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} ${pct} persen terpakai`}
      >
        <div
          className={`h-full rounded-full ${usage.isOverBudget ? "bg-expense" : "bg-primary"}`}
          style={{ width: `${usage.barPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-body-sm">
        <span className="text-on-surface-variant">{pct}% terpakai</span>
        {usage.isOverBudget ? (
          <span className="flex items-center gap-1 text-expense">
            <Icon name="error" size={16} />
            Melebihi batas
          </span>
        ) : isNear ? (
          <span className="flex items-center gap-1 text-on-surface-variant">
            <Icon name="warning" size={16} />
            Mendekati batas
          </span>
        ) : (
          <span className="text-on-surface-variant">Normal</span>
        )}
      </div>
    </li>
  );
}
