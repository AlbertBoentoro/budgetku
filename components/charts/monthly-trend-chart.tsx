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
import { Icon } from "@/components/ui/icon";

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
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-sm text-on-surface shadow-sm">
      <p className="font-medium">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="text-on-surface-variant">
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
    <div className="flex min-w-0 flex-col gap-4">
      {/* The SVG is a visual aid; the sr-only table below and the latest-month
          rows carry every value as text. */}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          barGap={4}
        >
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--outline-variant))"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--on-surface-variant))", fontSize: 12 }}
          />
          <YAxis
            tickFormatter={formatAxisTick}
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fill: "hsl(var(--on-surface-variant))", fontSize: 11 }}
          />
          <Tooltip
            content={<TrendTooltip />}
            cursor={{ fill: "hsl(var(--surface-container))" }}
          />
          <Legend
            formatter={(value) => (
              <span className="text-label-md text-on-surface">
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

      {/* Every month as text for screen readers, so no value needs hover. */}
      <table className="sr-only">
        <caption>Pemasukan dan pengeluaran per bulan</caption>
        <thead>
          <tr>
            <th scope="col">Bulan</th>
            <th scope="col">{INCOME_LABEL}</th>
            <th scope="col">{EXPENSE_LABEL}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{idrFormatter.format(point.income)}</td>
              <td>{idrFormatter.format(point.expense)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Latest-month figures in text, so values are visible without hover.
          Stacked rows so long amounts never squeeze at 320px. */}
      {latest ? (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-3">
          <TrendRow
            glyph="arrow_downward"
            glyphClass="text-income"
            label={`${INCOME_LABEL} (${latest.label})`}
            value={latest.income}
            tone="income"
          />
          <TrendRow
            glyph="arrow_upward"
            glyphClass="text-expense"
            label={`${EXPENSE_LABEL} (${latest.label})`}
            value={-latest.expense}
            tone="expense"
          />
        </div>
      ) : null}
    </div>
  );
}

function TrendRow({
  glyph,
  glyphClass,
  label,
  value,
  tone,
}: {
  glyph: string;
  glyphClass: string;
  label: string;
  value: number;
  tone: "income" | "expense";
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <span className="inline-flex items-center gap-1 text-label-md text-on-surface-variant">
        <Icon name={glyph} size={16} className={glyphClass} />
        {label}
      </span>
      {/* Size on the wrapper: tailwind-merge treats text-title-md as a color
          and would drop the tone class if both were passed together. */}
      <span className="ml-auto text-title-md font-semibold">
        <AmountText value={value} tone={tone} size="none" signed />
      </span>
    </div>
  );
}
