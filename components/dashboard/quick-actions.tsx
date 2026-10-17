import Link from "next/link";

import { Icon } from "@/components/ui/icon";

// Dashboard quick actions: four tiles linking to existing routes. Static links
// only (no client state), so this stays a server component and keeps the
// dashboard prerenderable. Each tile names its result in Indonesian and uses a
// Material Symbol glyph; no fabricated metric, no decorative arrow. The primary
// "Catat" action lives in the bottom nav, so these tiles are uniform.
interface QuickAction {
  label: string;
  href: string;
  glyph: string;
}

const ACTIONS: QuickAction[] = [
  { label: "Target Tabungan", href: "/goals", glyph: "savings" },
  { label: "Impor Mail", href: "/settings/gmail", glyph: "forward_to_inbox" },
  { label: "Laporan", href: "/reports", glyph: "analytics" },
  { label: "Transaksi Rutin", href: "/recurring", glyph: "event_repeat" },
];

export function QuickActions() {
  return (
    <section aria-label="Aksi cepat">
      <ul className="grid grid-cols-4 gap-md">
        {ACTIONS.map((action) => (
          <li key={action.href}>
            <Link
              href={action.href}
              className="flex min-h-[44px] flex-col items-center gap-2 rounded-xl bg-surface-container-lowest p-3 shadow-sm transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
                <Icon name={action.glyph} size={22} />
              </span>
              <span className="text-label-md text-center text-on-surface">
                {action.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
