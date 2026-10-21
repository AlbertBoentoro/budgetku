"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  RecurringListRow,
  type RecurringRowView,
} from "@/components/finance/recurring-list-row";

interface RecurringListProps {
  active: RecurringRowView[];
  paused: RecurringRowView[];
}

type Tab = "active" | "paused";

const EMPTY_COPY: Record<Tab, string> = {
  active: "Belum ada jadwal aktif.",
  paused: "Belum ada jadwal yang dijeda atau nonaktif.",
};

// Tabbed manager over the server-provided active/paused groups. Client tab
// state only; the rows call the existing server actions. One shared live region
// surfaces a failed toggle/generate/delete. The footer states the truth: these
// are schedules the user records manually (no auto-posting), so no notification
// or auto-debit is promised.
export function RecurringList({ active, paused }: RecurringListProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("active");

  const groups: Record<Tab, RecurringRowView[]> = { active, paused };
  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: "active", label: "Aktif", count: active.length },
    { value: "paused", label: "Dijeda / Nonaktif", count: paused.length },
  ];
  const current = groups[tab];

  return (
    <div className="flex flex-col gap-4">
      {actionError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-body-sm text-expense"
        >
          {actionError}
        </p>
      ) : null}

      <div
        role="group"
        aria-label="Saring transaksi berulang"
        className="grid grid-cols-2 gap-1 rounded-xl bg-surface-container-low p-1"
      >
        {tabs.map((t) => {
          const selected = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setTab(t.value)}
              className={cn(
                "flex h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-body-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              {t.label} ({t.count})
            </button>
          );
        })}
      </div>

      {current.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {current.map((template) => (
            <RecurringListRow
              key={template.id}
              template={template}
              onError={setActionError}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-1 rounded-xl bg-surface-container-lowest p-lg text-center shadow-sm">
          <p className="max-w-xs text-body-sm text-on-surface-variant">
            {EMPTY_COPY[tab]}
          </p>
        </div>
      )}

      <p className="text-body-sm text-on-surface-variant">
        Transaksi berulang di sini adalah jadwal pengingat. Pencatatan ke buku
        kas kamu lakukan sendiri lewat tombol Catat sekarang.
      </p>
    </div>
  );
}
