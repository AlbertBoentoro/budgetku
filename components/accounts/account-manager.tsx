"use client";

import { useState } from "react";

import type { AccountAccent } from "@/lib/accounts";
import { AmountText } from "@/components/finance/amount-text";
import { Icon } from "@/components/ui/icon";
import { AccountRow, type AccountRowView } from "@/components/accounts/account-row";

// One grouped section = a real account_type with the accounts the user has of
// that type. Subtotal is the sum of those accounts' running balances (honest
// arithmetic over the whole group, documented by the count badge).
export interface AccountSection {
  type: string;
  label: string;
  glyph: string;
  accent: AccountAccent;
  subtotal: number;
  rows: AccountRowView[];
}

interface AccountManagerProps {
  sections: AccountSection[];
  archived: AccountRowView[];
}

// Client owner of the grouped account sections, the collapsible archived
// section, and the single shared action-error live region. No data fetching
// happens here: the view model is built on the server and passed as props.
export function AccountManager({ sections, archived }: AccountManagerProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {actionError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-body-sm text-destructive"
        >
          {actionError}
        </p>
      ) : null}

      {sections.map((section) => (
        <section
          key={section.type}
          className="flex flex-col rounded-xl bg-surface-container-lowest shadow-sm"
        >
          <header className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
              <Icon name={section.glyph} size={20} />
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-title-md text-on-surface">
                {section.label}
              </span>
              <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 text-label-xs text-on-surface-variant">
                {section.rows.length}
              </span>
            </span>
            <AmountText
              value={section.subtotal}
              size="none"
              tone={section.subtotal < 0 ? "expense" : "default"}
              className="text-currency-body"
            />
          </header>
          <ul className="flex flex-col divide-y divide-outline-variant border-t border-outline-variant">
            {section.rows.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                onError={setActionError}
              />
            ))}
          </ul>
        </section>
      ))}

      {archived.length > 0 ? (
        <section className="flex flex-col rounded-xl bg-surface-container-lowest shadow-sm">
          <button
            type="button"
            onClick={() => setArchivedOpen((prev) => !prev)}
            aria-expanded={archivedOpen}
            className="flex min-h-[44px] items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
              <Icon name="inventory_2" size={20} />
            </span>
            <span className="flex min-w-0 flex-1 text-title-md text-on-surface-variant">
              Arsip ({archived.length})
            </span>
            <Icon
              name={archivedOpen ? "expand_less" : "expand_more"}
              size={22}
              className="shrink-0 text-on-surface-variant"
            />
          </button>
          {archivedOpen ? (
            <ul className="flex flex-col divide-y divide-outline-variant border-t border-outline-variant">
              {archived.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  onError={setActionError}
                />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
