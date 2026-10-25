"use client";

import { useEffect, useState } from "react";

import { AmountText } from "@/components/finance/amount-text";
import { Icon } from "@/components/ui/icon";

// Stable key for persisting the hide/show preference. No data leaves the
// client; only a boolean preference is stored.
const HIDDEN_STORAGE_KEY = "budgetku:balance-hidden";

// Fixed mask rendered in place of the amount when hidden. Kept at the same
// text size as the balance so toggling does not shift layout.
const BALANCE_MASK = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";

interface NetBalanceCardProps {
  balance: number;
  // Running balances may be incomplete (transactions fetch failed); show a
  // quiet notice rather than presenting the total as final.
  incomplete: boolean;
  income: number;
  expense: number;
  // This-month summary could not be loaded; replace the pills with a notice.
  monthIncomplete: boolean;
}

// Net balance card with a working client-side hide/show toggle. The balance and
// monthly figures are real, server-computed numbers passed in as props; no
// fetching happens here. Income/expense meaning is carried by label +
// sign + tone together, never color alone.
export function NetBalanceCard({
  balance,
  incomplete,
  income,
  expense,
  monthIncomplete,
}: NetBalanceCardProps) {
  const balanceLength = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(balance).length;
  const balanceSize =
    balanceLength > 14
      ? "text-[clamp(0.5rem,4vw,2rem)]"
      : "text-[clamp(1rem,11vw,2.75rem)]";

  // Default visible so the first client render matches the server output; the
  // stored preference is applied after mount to avoid a hydration mismatch.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(HIDDEN_STORAGE_KEY) === "1") {
        setHidden(true);
      }
    } catch {
      // Private mode or storage disabled: keep the default (visible).
    }
  }, []);

  function toggleHidden() {
    setHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HIDDEN_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore storage failures; the toggle still works for this session.
      }
      return next;
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex items-center justify-between gap-2 max-[240px]:flex-col max-[240px]:items-start">
        <span className="text-label-xs uppercase tracking-wide text-on-surface-variant">
          Total Saldo Bersih
        </span>
        <div className="flex items-center gap-2 max-[240px]:w-full max-[240px]:justify-end">
          {/* Static honest status label: the account is active. No metric. */}
          <span className="inline-flex items-center gap-1 text-label-md text-on-surface-variant">
            <span className="size-2 rounded-full bg-secondary" aria-hidden />
            Aktif
          </span>
          <button
            type="button"
            onClick={toggleHidden}
            aria-pressed={hidden}
            aria-label={hidden ? "Tampilkan saldo" : "Sembunyikan saldo"}
            className="flex size-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon name={hidden ? "visibility_off" : "visibility"} size={22} />
          </button>
        </div>
      </div>

      {hidden ? (
        <span
          className={`max-w-full overflow-hidden text-ellipsis ${balanceSize} font-bold leading-[1.1] tabular-nums tracking-tight text-on-surface`}
        >
          {BALANCE_MASK}
        </span>
      ) : (
        <AmountText
          value={balance}
          size="none"
          className={`max-w-full overflow-hidden text-ellipsis ${balanceSize} font-bold leading-[1.1] tracking-tight text-on-surface`}
        />
      )}

      {incomplete ? (
        <p role="alert" className="text-body-sm text-on-surface-variant">
          Saldo mungkin belum lengkap. Coba muat ulang.
        </p>
      ) : null}

      {monthIncomplete ? (
        <p role="alert" className="text-body-sm text-on-surface-variant">
          Ringkasan bulan ini belum bisa dimuat. Coba muat ulang.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 min-[448px]:grid-cols-2">
          <SummaryPill
            label="Pemasukan"
            glyph="arrow_downward"
            value={income}
            tone="income"
          />
          <SummaryPill
            label="Pengeluaran"
            glyph="arrow_upward"
            value={-expense}
            tone="expense"
          />
        </div>
      )}
    </section>
  );
}

interface SummaryPillProps {
  label: string;
  glyph: string;
  value: number;
  tone: "income" | "expense";
}

function SummaryPill({ label, glyph, value, tone }: SummaryPillProps) {
  const toneClass =
    tone === "income"
      ? "text-income"
      : "text-expense";
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-surface-container-low p-2.5">
      <span className="inline-flex items-center gap-1 text-label-md text-on-surface-variant">
        <Icon name={glyph} size={16} className={toneClass} />
        {label}
      </span>
      <span className="max-w-full overflow-hidden text-ellipsis">
        <AmountText
          value={value}
          tone={tone}
          size="none"
          signed
          className="text-[clamp(0.375rem,3.5vw,0.8125rem)] font-semibold tabular-nums sm:text-title-md"
        />
      </span>
    </div>
  );
}
