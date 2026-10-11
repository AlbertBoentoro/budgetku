"use client";

import { useState } from "react";

import {
  RecurringListRow,
  type RecurringRowView,
} from "@/components/finance/recurring-list-row";

interface RecurringListProps {
  active: RecurringRowView[];
  paused: RecurringRowView[];
}

// Grouped list: "Aktif" first, then "Jeda" (each section renders only when it
// has entries). Action results (a failed toggle/generate/delete) surface in one
// shared live region, mirroring the transactions list.
export function RecurringList({ active, paused }: RecurringListProps) {
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {actionError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {actionError}
        </p>
      ) : null}

      {active.length > 0 ? (
        <RecurringSection
          title="Aktif"
          templates={active}
          onError={setActionError}
        />
      ) : null}

      {paused.length > 0 ? (
        <RecurringSection
          title="Jeda"
          templates={paused}
          onError={setActionError}
        />
      ) : null}
    </div>
  );
}

function RecurringSection({
  title,
  templates,
  onError,
}: {
  title: string;
  templates: RecurringRowView[];
  onError: (message: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {templates.map((template) => (
          <RecurringListRow
            key={template.id}
            template={template}
            onError={onError}
          />
        ))}
      </ul>
    </section>
  );
}
