"use client";

import { useState } from "react";

import {
  TransactionListRow,
  type TransactionRowView,
} from "@/components/finance/transaction-list-row";

interface TransactionListProps {
  transactions: TransactionRowView[];
}

export function TransactionList({ transactions }: TransactionListProps) {
  // Action results (e.g. a failed delete) surface in one shared live region
  // instead of per-row messages, mirroring the accounts list.
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
        {transactions.map((transaction) => (
          <TransactionListRow
            key={transaction.id}
            transaction={transaction}
            onError={setActionError}
          />
        ))}
      </ul>
    </div>
  );
}
