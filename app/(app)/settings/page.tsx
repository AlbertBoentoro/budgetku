import { Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { AppBackLink } from "@/components/layout/app-back-link";
import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { LogoutConfirm } from "@/components/settings/logout-confirm";
import { ThemeSettingRow } from "@/components/settings/theme-setting-row";
import { SettingsLoading } from "@/app/(app)/settings/loading";

export default function SettingsPage() {
  return (
    <>
      <AppHeader
        title="Pengaturan"
        titleAction={
          <AppBackLink href="/dashboard" label="Kembali ke Beranda" />
        }
      />
      <PageContainer className="pb-6">
        <Suspense fallback={<SettingsLoading />}>
          <SettingsContent />
        </Suspense>
      </PageContainer>
    </>
  );
}

async function SettingsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already redirects unauthenticated users; this guard keeps
  // the page strictly scoped and avoids a crash if the session just expired.
  if (!user) {
    return <SettingsError />;
  }

  // Email/password sign-up stores no name, so a name is shown only when the
  // auth metadata really has one (e.g. a future OAuth sign-in). Never invented.
  const meta = user.user_metadata ?? {};
  const rawName =
    typeof meta.full_name === "string"
      ? meta.full_name
      : typeof meta.name === "string"
        ? meta.name
        : "";
  const displayName = rawName.trim();
  const email = user.email?.trim() ?? "";

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="settings-account" className="flex flex-col gap-3">
        <h2
          id="settings-account"
          className="px-1 text-label-md font-semibold text-on-surface-variant"
        >
          Akun
        </h2>
        <div className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
            <Icon name="person" size={26} />
          </span>
          {/* min-w-0 + break-words: long names/emails wrap inside the card at
              320px instead of overflowing; truncation would hide the identity. */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {displayName ? (
              <>
                <p className="break-words text-title-md text-on-surface">
                  {displayName}
                </p>
                <p className="break-words text-body-sm text-on-surface-variant">
                  {email || "Email tidak tersedia"}
                </p>
              </>
            ) : email ? (
              <p className="break-words text-title-md text-on-surface">
                {email}
              </p>
            ) : (
              <p className="text-body-sm text-on-surface-variant">
                Email tidak tersedia
              </p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="settings-features" className="flex flex-col gap-3">
        <h2
          id="settings-features"
          className="px-1 text-label-md font-semibold text-on-surface-variant"
        >
          Fitur
        </h2>
        <ul className="flex flex-col divide-y divide-outline-variant overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
          <SettingsLinkRow
            href="/reports"
            glyph="bar_chart"
            title="Laporan"
            description="Lihat ringkasan keuangan dan pengeluaran."
          />
          {/* Entry point to manage recurring templates (created via the
              Transaksi berulang checkbox on Tambah transaksi). */}
          <SettingsLinkRow
            href="/recurring"
            glyph="event_repeat"
            title="Transaksi berulang"
            description="Kelola jadwal pemasukan dan pengeluaran berulang."
          />
          {/* Entry point to connect Gmail and review detected transaction
              drafts before any transaction is saved. */}
          <SettingsLinkRow
            href="/settings/gmail"
            glyph="mail"
            title="Impor dari Gmail"
            description="Deteksi transaksi dari email BCA, ShopeePay, dan GoPay."
          />
          <ThemeSettingRow />
        </ul>
      </section>

      <LogoutConfirm />
    </div>
  );
}

function SettingsLinkRow({
  href,
  glyph,
  title,
  description,
}: {
  href: string;
  glyph: string;
  title: string;
  description: string;
}) {
  const className =
    "flex min-h-[64px] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name={glyph} size={22} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body-md font-medium text-on-surface">
          {title}
        </span>
        <span className="text-body-sm text-on-surface-variant">
          {description}
        </span>
      </span>
    </>
  );

  return (
    <li>
      <Link href={href} className={className}>
        {content}
        <Icon
          name="chevron_right"
          size={20}
          className="shrink-0 text-on-surface-variant"
        />
      </Link>
    </li>
  );
}

function SettingsError() {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <p className="max-w-xs text-body-sm text-on-surface-variant">
        Sesi berakhir. Silakan masuk kembali.
      </p>
      <Button asChild variant="outline" className="h-11">
        <Link href="/auth/login">Masuk lagi</Link>
      </Button>
    </div>
  );
}
