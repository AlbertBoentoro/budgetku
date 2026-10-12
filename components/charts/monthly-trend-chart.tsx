"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonthlyTrendPoint } from "@/lib/reports";
import { AmountText } from "@/components/finance/amount-text";

interface MonthlyTrendChartProps {
  data: MonthlyTrendPoint[];
}

const INCOME_LABEL = "Pemasukan";
const EXPENSE_LABEL = "Pengeluaran";

// IDR, id-ID, no decimals, matching AmountText (value is never scaled here).
const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

// Compact axis labels (e.g. "Rp1,2 jt") so Y ticks fit on a phone without
// overflow; the exact rupiah is always available in the tooltip and summary.
function formatAxisTick(value: number): string {
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)} jt`;
  if (value >= 1_000) return `Rp${Math.round(value / 1_000)} rb`;
  return `Rp${value}`;
}

interface TrendTooltipItem {
  dataKey: string;
  value: number;
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TrendTooltipItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-soft">
      <p className="font-medium">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="text-muted-foreground">
          {item.dataKey === "income" ? INCOME_LABEL : EXPENSE_LABEL}:{" "}
          {idrFormatter.format(item.value)}
        </p>
      ))}
    </div>
  );
}

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const latest = data[data.length - 1];

  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          barGap={4}
        >
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--border))"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <YAxis
            tickFormatter={formatAxisTick}
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          />
          <Tooltip
            content={<TrendTooltip />}
            cursor={{ fill: "hsl(var(--muted))" }}
          />
          <Legend
            formatter={(value) => (
              <span className="text-sm text-foreground">
                {value === "income" ? INCOME_LABEL : EXPENSE_LABEL}
              </span>
            )}
          />
          <Bar
            dataKey="income"
            name="income"
            fill="hsl(var(--income))"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="expense"
            name="expense"
            fill="hsl(var(--expense))"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Latest-month figures in text, so values are accessible without hover. */}
      {latest ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-2xl border bg-card p-4 shadow-soft">
            <span className="text-sm text-muted-foreground">
              {INCOME_LABEL} ({latest.label})
            </span>
            <AmountText value={latest.income} tone="income" size="md" signed />
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border bg-card p-4 shadow-soft">
            <span className="text-sm text-muted-foreground">
              {EXPENSE_LABEL} ({latest.label})
            </span>
            <AmountText
              value={-latest.expense}
              tone="expense"
              size="md"
              signed
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
