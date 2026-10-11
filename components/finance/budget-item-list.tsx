"use client";

import { useState } from "react";

import type { BudgetItemView } from "@/lib/budgets";
import { BudgetItemRow } from "@/components/finance/budget-item-row";

interface BudgetItemListProps {
  items: BudgetItemView[];
  monthParam: string;
}

export function BudgetItemList({ items, monthParam }: BudgetItemListProps) {
  // Action results (e.g. a failed delete) surface in one shared live region
  // instead of per-row messages, mirroring the transaction list.
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {actionError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {actionError}
        </p>
      ) : null}

      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {items.map((item) => (
          <BudgetItemRow
            key={item.id}
            item={item}
            monthParam={monthParam}
            onError={setActionError}
          />
        ))}
      </ul>
    </div>
  );
}
