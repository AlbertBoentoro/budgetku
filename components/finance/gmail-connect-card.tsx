import { Mail, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Not-connected state (design §11). Honest explanation that Budgetku reads
 * Gmail READ-ONLY to detect BCA/Shopee/GoPay transactions, that detection is
 * best-effort, and that nothing is saved without the user's confirmation. The
 * primary action links straight to the server connect route.
 *
 * Server component: it renders a plain anchor to GET /api/gmail/connect (which
 * sets the CSRF-state cookie and redirects to Google); no client state needed.
 */
export function GmailConnectCard() {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <Mail className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Hubungkan Gmail</h2>
          <p className="text-sm text-muted-foreground">
            Budgetku membaca email kamu secara hanya-baca untuk mendeteksi
            transaksi dari BCA, Shopee, dan GoPay. Deteksi bersifat perkiraan dan
            bisa meleset.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-md border border-input bg-muted/30 p-3">
        <ShieldCheck
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <p className="text-sm text-muted-foreground">
          Tidak ada transaksi yang tersimpan tanpa kamu konfirmasi dulu. Budgetku
          tidak bisa mengirim atau mengubah email kamu.
        </p>
      </div>

      <Button asChild className="h-11">
        {/* Plain anchor, not next/link: /api/gmail/connect is a route handler
            that sets the state cookie then 3xx-redirects to Google. */}
        <a href="/api/gmail/connect">
          <Mail aria-hidden />
          Hubungkan Gmail
        </a>
      </Button>
    </section>
  );
}
