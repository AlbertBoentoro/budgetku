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
          className="rounded-lg border border-error/40 bg-error-container px-3 py-2 text-body-sm text-on-error-container"
        >
          {actionError}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
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
