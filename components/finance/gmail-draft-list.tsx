"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { AccountRow, CategoryRow } from "@/lib/transactions";
import {
  GmailDraftRow,
  type GmailDraftView,
} from "@/components/finance/gmail-draft-row";
import {
  GmailImportReview,
  type DraftCandidate,
} from "@/components/finance/gmail-import-review";

// The server-resolved review state for an opened draft (?review=<id>):
//   - ok:        the message re-parsed; render the editable review form.
//   - transient: a transient re-fetch failure; keep the draft, show retry copy.
//   - gone:      the message is permanently gone; it was marked failed.
export type GmailReviewState =
  | {
      kind: "ok";
      importId: string;
      candidate: DraftCandidate;
      receivedDate: string;
    }
  | { kind: "transient"; importId: string }
  | { kind: "gone"; importId: string };

interface GmailDraftListProps {
  drafts: GmailDraftView[];
  accounts: AccountRow[];
  incomeCategories: CategoryRow[];
  expenseCategories: CategoryRow[];
  // Present only when the user opened a specific draft (?review=<id>).
  review: GmailReviewState | null;
}

/**
 * "Perlu ditinjau" section (design §11). Lists needs_review/failed rows from
 * stored metadata only. When a draft is opened (?review=<id>), the server
 * resolves a review state and this component renders either the editable review
 * form (ok) or an honest message (transient re-fetch failure / message gone).
 * Showing the real list length is allowed; no invented totals.
 */
export function GmailDraftList({
  drafts,
  accounts,
  incomeCategories,
  expenseCategories,
  review,
}: GmailDraftListProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function closeReview() {
    router.push("/settings/gmail", { scroll: false });
  }

  const noAccounts = accounts.length === 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title-md text-on-surface">Perlu ditinjau</h2>
        <span className="text-label-md text-on-surface-variant tabular-nums">
          {drafts.length}
        </span>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-body-sm text-expense"
        >
          {error}
        </p>
      ) : null}

      {review && review.kind === "ok" ? (
        noAccounts ? (
          <p
            role="alert"
            className="rounded-lg border border-border bg-surface-container px-3 py-2 text-body-sm text-on-surface-variant"
          >
            Tambahkan rekening dulu di menu Rekening sebelum menyimpan transaksi
            dari email.
          </p>
        ) : (
          <GmailImportReview
            importId={review.importId}
            candidate={review.candidate}
            accounts={accounts}
            incomeCategories={incomeCategories}
            expenseCategories={expenseCategories}
            receivedDate={review.receivedDate}
            onCancel={closeReview}
          />
        )
      ) : null}

      {review && review.kind === "transient" ? (
        <p
          role="alert"
          className="rounded-lg border border-border bg-surface-container px-3 py-2 text-body-sm text-on-surface-variant"
        >
          Tidak bisa memuat ulang detail email ini sekarang. Coba lagi.
        </p>
      ) : null}

      {review && review.kind === "gone" ? (
        <p
          role="alert"
          className="rounded-lg border border-border bg-surface-container px-3 py-2 text-body-sm text-on-surface-variant"
        >
          Email ini tidak bisa ditemukan lagi. Kamu bisa mengabaikannya atau
          menambahkan transaksinya secara manual.
        </p>
      ) : null}

      <ul className="flex flex-col divide-y divide-outline-variant rounded-xl border border-border bg-surface-container-lowest">
        {drafts.map((draft) => (
          <GmailDraftRow key={draft.id} draft={draft} onError={setError} />
        ))}
      </ul>
    </section>
  );
}
