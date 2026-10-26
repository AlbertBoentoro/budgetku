import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

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
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-container-lowest p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <Icon name="mail" size={22} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-title-md text-on-surface">Hubungkan Gmail</h2>
          <p className="text-body-sm text-on-surface-variant">
            Budgetku membaca email kamu secara hanya-baca untuk mendeteksi
            transaksi dari BCA, Shopee, dan GoPay. Deteksi bersifat perkiraan dan
            bisa meleset.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-container p-3">
        <Icon
          name="lock"
          size={18}
          className="mt-0.5 shrink-0 text-on-surface-variant"
        />
        <p className="text-body-sm text-on-surface-variant">
          Tidak ada transaksi yang tersimpan tanpa kamu konfirmasi dulu. Budgetku
          tidak bisa mengirim atau mengubah email kamu.
        </p>
      </div>

      <Button asChild className="h-11">
        {/* Plain anchor, not next/link: /api/gmail/connect is a route handler
            that sets the state cookie then 3xx-redirects to Google. */}
        <a href="/api/gmail/connect">
          <Icon name="mail" size={18} aria-hidden />
          Hubungkan Gmail
        </a>
      </Button>
    </section>
  );
}
