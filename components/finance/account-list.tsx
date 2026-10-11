"use client";

import { useState } from "react";

import type { AccountRow } from "@/lib/accounts";
import { SectionHeader } from "@/components/shared/section-header";
import { AccountListRow } from "@/components/finance/account-list-row";

interface AccountListProps {
  active: AccountRow[];
  archived: AccountRow[];
  // Running balance per account id (initial_balance + transaction net),
  // computed server-side. Rows fall back to initial_balance if an id is missing.
  balances: Map<string, number>;
  // True when the transactions fetch failed and balances fell back to
  // initial_balance, so the UI can note the figures may be incomplete.
  balancesIncomplete?: boolean;
}

export function AccountList({
  active,
  archived,
  balances,
  balancesIncomplete = false,
}: AccountListProps) {
  // Action results (e.g. "still in use" when deleting) surface here so the
  // whole list shares one live region instead of per-row messages.
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {balancesIncomplete ? (
        <p
          role="alert"
          className="rounded-md border px-3 py-2 text-sm text-muted-foreground"
        >
          Saldo mungkin belum lengkap. Coba muat ulang.
        </p>
      ) : null}

      {actionError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {actionError}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <SectionHeader title="Rekening" />
        {active.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">
            Semua rekening sedang diarsipkan.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-2xl border bg-card">
            {active.map((account) => (
              <AccountListRow
                key={account.id}
                account={account}
                balance={balances.get(account.id) ?? account.initial_balance}
                onError={setActionError}
              />
            ))}
          </ul>
        )}
      </section>

      {archived.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeader title="Diarsipkan" />
          <ul className="flex flex-col divide-y rounded-2xl border bg-card">
            {archived.map((account) => (
              <AccountListRow
                key={account.id}
                account={account}
                balance={balances.get(account.id) ?? account.initial_balance}
                onError={setActionError}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
