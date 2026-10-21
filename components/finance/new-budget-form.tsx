"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import type { ActionResult } from "@/app/(app)/budget/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NewBudgetFormProps {
  action: (notes?: string) => Promise<ActionResult>;
  monthParam: string;
  monthLabel: string;
}

export function NewBudgetForm({
  action,
  monthParam,
  monthLabel,
}: NewBudgetFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const notesId = useId();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmed = notes.trim();
    startTransition(async () => {
      const result = await action(trimmed.length > 0 ? trimmed : undefined);
      if (result.ok) {
        router.push(`/budget?month=${monthParam}`);
        router.refresh();
        return;
      }
      setFormError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <Label>Bulan anggaran</Label>
        <p className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
          {monthLabel}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={notesId}>Catatan</Label>
        <Input
          id={notesId}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-11"
          placeholder="Opsional, misal: fokus hemat transport"
          autoComplete="off"
        />
      </div>

      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-expense"
        >
          {formError}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" className="h-11 flex-1" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Tambah anggaran"}
        </Button>
        <Button asChild type="button" variant="outline" className="h-11">
          <Link href={`/budget?month=${monthParam}`}>Batal</Link>
        </Button>
      </div>
    </form>
  );
}
