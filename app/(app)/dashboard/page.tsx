import {
  Banknote,
  CreditCard,
  PiggyBank,
  Receipt,
  Wallet,
} from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { PageContainer } from "@/components/layout/page-container";
import { AccountCard } from "@/components/finance/account-card";
import { AmountText } from "@/components/finance/amount-text";
import { BalanceCard } from "@/components/finance/balance-card";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";

// Static demo data only — the real data layer arrives in a later feature.
// Account balances sum to DEMO_TOTAL_BALANCE (kept internally consistent).
const accounts = [
  {
    name: "Rekening giro",
    balance: 4820000,
    accent: "blue" as const,
    icon: Wallet,
  },
  {
    name: "Tabungan",
    balance: 7210000,
    accent: "emerald" as const,
    icon: PiggyBank,
  },
  {
    name: "Kartu kredit",
    balance: -315000,
    accent: "violet" as const,
    icon: CreditCard,
  },
  { name: "Tunai", balance: 630000, accent: "amber" as const, icon: Banknote },
];

// 4820000 + 7210000 - 315000 + 630000 = 12345000
const DEMO_TOTAL_BALANCE = 12345000;

const recentActivity = [
  {
    id: "1",
    label: "Gaji",
    date: "1 Mar",
    value: 3200000,
    tone: "income" as const,
  },
  {
    id: "2",
    label: "Belanja",
    date: "3 Mar",
    value: -84000,
    tone: "expense" as const,
  },
  {
    id: "3",
    label: "Listrik",
    date: "4 Mar",
    value: -62000,
    tone: "expense" as const,
  },
  {
    id: "4",
    label: "Pengembalian dana",
    date: "5 Mar",
    value: 30000,
    tone: "income" as const,
  },
];

export default function DashboardPage() {
  return (
    <>
      <AppHeader title="Beranda" />
      <PageContainer>
        <BalanceCard
          balance={DEMO_TOTAL_BALANCE}
          subtitle={
            // Demo indicator — remove once the real data layer lands.
            <span className="inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Data contoh
            </span>
          }
        />

        <section className="flex flex-col gap-3">
          <SectionHeader title="Rekening" />
          <div className="grid grid-cols-1 min-[375px]:grid-cols-2 gap-3">
            {accounts.map((account) => (
              <AccountCard
                key={account.name}
                name={account.name}
                balance={account.balance}
                accent={account.accent}
                icon={account.icon}
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader title="Transaksi terakhir" />
          {recentActivity.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Belum ada transaksi"
              description="Transaksi terakhirmu akan muncul di sini."
            />
          ) : (
            <ul className="flex flex-col divide-y rounded-2xl border bg-card">
              {recentActivity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-sm text-muted-foreground">
                      {item.date}
                    </span>
                  </div>
                  <AmountText
                    value={item.value}
                    tone={item.tone}
                    size="sm"
                    signed
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </PageContainer>
    </>
  );
}
