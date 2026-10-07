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

// Static placeholder data only — the data layer arrives in a later feature.
const accounts = [
  { name: "Checking", balance: 4820.5, accent: "blue" as const, icon: Wallet },
  {
    name: "Savings",
    balance: 7210.0,
    accent: "emerald" as const,
    icon: PiggyBank,
  },
  {
    name: "Credit",
    balance: -315.17,
    accent: "violet" as const,
    icon: CreditCard,
  },
  { name: "Cash", balance: 630.34, accent: "amber" as const, icon: Banknote },
];

const recentActivity = [
  {
    id: "1",
    label: "Salary",
    date: "Mar 1",
    value: 3200,
    tone: "income" as const,
  },
  {
    id: "2",
    label: "Groceries",
    date: "Mar 3",
    value: -84.21,
    tone: "expense" as const,
  },
  {
    id: "3",
    label: "Electricity",
    date: "Mar 4",
    value: -62.5,
    tone: "expense" as const,
  },
  {
    id: "4",
    label: "Refund",
    date: "Mar 5",
    value: 29.99,
    tone: "income" as const,
  },
];

export default function DashboardPage() {
  return (
    <>
      <AppHeader title="Home" subtitle="Your money at a glance" />
      <PageContainer>
        <BalanceCard balance={12345.67} />

        <section className="flex flex-col gap-3">
          <SectionHeader title="Accounts" />
          <div className="grid grid-cols-2 gap-3">
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
          <SectionHeader title="Recent activity" />
          {recentActivity.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No transactions yet"
              description="Your recent activity will show up here."
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
                  <AmountText value={item.value} tone={item.tone} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </PageContainer>
    </>
  );
}
