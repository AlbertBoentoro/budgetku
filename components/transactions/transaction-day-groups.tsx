"use client";

import { useState } from "react";

import type { TransactionDayGroup } from "@/lib/transactions";
import { AmountText } from "@/components/finance/amount-text";
import {
  TransactionLedgerRow,
  type TransactionRowView,
} from "@/components/transactions/transaction-ledger-row";

interface TransactionDayGroupsProps {
  groups: TransactionDayGroup<TransactionRowView>[];
}

// Renders the date-grouped ledger: each day is a header (date label + per-day
// net) above a card of Stitch rows with dividers. Owns the single shared live
// region for a failed delete, mirroring the old TransactionList. Grouping and
// per-day nets are computed on the server (groupTransactionsByDay); this
// component only presents them.
export function TransactionDayGroups({ groups }: TransactionDayGroupsProps) {
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      {actionError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-body-sm text-expense"
        >
          {actionError}
        </p>
      ) : null}

      {groups.map((group) => {
        const netTone =
          group.netTotal > 0
            ? "income"
            : group.netTotal < 0
              ? "expense"
              : "default";
        return (
          <section key={group.key} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2 px-xs">
              <h2 className="text-label-md font-medium text-on-surface-variant">
                {group.label}
              </h2>
              <AmountText
                value={group.netTotal}
                tone={netTone}
                size="none"
                signed
                className="text-label-md font-semibold tabular-nums"
              />
            </div>
            <ul className="flex flex-col divide-y divide-outline-variant rounded-xl border border-outline-variant bg-surface-container-lowest">
              {group.rows.map((transaction) => (
                <TransactionLedgerRow
                  key={transaction.id}
                  transaction={transaction}
                  onError={setActionError}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
