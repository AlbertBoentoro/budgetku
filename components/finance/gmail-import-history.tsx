import { Check, Mail } from "lucide-react";

// One processed entry (imported or ignored) from stored metadata only.
export interface GmailHistoryView {
  id: string;
  subject: string | null;
  sender: string | null;
  processedAt: string | null;
  status: "imported" | "ignored";
}

interface GmailImportHistoryProps {
  entries: GmailHistoryView[];
}

function formatProcessed(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

function formatSender(sender: string | null): string {
  if (!sender) return "Pengirim tidak diketahui";
  const angle = sender.match(/^\s*"?([^"<]+?)"?\s*</);
  if (angle && angle[1].trim()) return angle[1].trim();
  return sender.trim();
}

/**
 * Read-only history of imported and ignored emails (design §11). Honest status
 * labels, no fabricated counts: the section header shows the true list length,
 * which is allowed because each item is a concrete row the user can see.
 * Server component (no interactivity).
 */
export function GmailImportHistory({ entries }: GmailImportHistoryProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Riwayat</h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {entries.length}
        </span>
      </div>

      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {entries.map((entry) => {
          const processed = formatProcessed(entry.processedAt);
          const isImported = entry.status === "imported";
          return (
            <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
              {isImported ? (
                <Check
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              ) : (
                <Mail
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  {entry.subject?.trim() || "(Tanpa subjek)"}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {formatSender(entry.sender)}
                  {processed ? ` · ${processed}` : ""}
                </span>
                <span className="text-sm text-muted-foreground">
                  {isImported ? "Sudah diimpor" : "Diabaikan"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
