import { Icon } from "@/components/ui/icon";

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
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title-md text-on-surface">Riwayat</h2>
        <span className="text-label-md text-on-surface-variant tabular-nums">
          {entries.length}
        </span>
      </div>

      <ul className="flex flex-col divide-y divide-outline-variant rounded-xl border border-border bg-surface-container-lowest">
        {entries.map((entry) => {
          const processed = formatProcessed(entry.processedAt);
          const isImported = entry.status === "imported";
          return (
            <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
                <Icon name={isImported ? "check" : "block"} size={20} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-body-md text-on-surface">
                  {entry.subject?.trim() || "(Tanpa subjek)"}
                </span>
                <span className="truncate text-body-sm text-on-surface-variant">
                  {formatSender(entry.sender)}
                  {processed ? ` \u00b7 ${processed}` : ""}
                </span>
                <span className="text-body-sm text-on-surface-variant">
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
