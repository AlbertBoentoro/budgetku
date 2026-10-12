"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AmountText } from "@/components/finance/amount-text";

export interface CategoryBreakdownDatum {
  name: string;
  amount: number;
  percent: number;
  // 0-based index used to cycle the --chart-1..5 tokens.
  colorIndex: number;
}

interface CategoryBreakdownChartProps {
  data: CategoryBreakdownDatum[];
}

// IDR, id-ID, no decimals, matching AmountText's presentation (value is never
// scaled here). Used only for the hover tooltip; every value is also printed as
// text in the list below, so meaning never depends on the chart or on color.
const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

// Cycle the existing chart tokens; fills are decorative only.
function chartColor(colorIndex: number): string {
  return `hsl(var(--chart-${(colorIndex % 5) + 1}))`;
}

interface TooltipPayloadItem {
  payload: CategoryBreakdownDatum;
}

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-soft">
      <p className="font-medium">{item.name}</p>
      <p className="text-muted-foreground">
        {idrFormatter.format(item.amount)} ({item.percent.toFixed(0)}%)
      </p>
    </div>
  );
}

export function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
  // Height scales with row count so bars stay readable and nothing overflows on
  // a narrow phone; a floor keeps a single-row chart from looking cramped.
  const chartHeight = Math.max(data.length * 44, 120);

  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
          barCategoryGap="24%"
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={96}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <Tooltip
            content={<CategoryTooltip />}
            cursor={{ fill: "hsl(var(--muted))" }}
          />
          <Bar dataKey="amount" radius={[4, 4, 4, 4]} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={chartColor(entry.colorIndex)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Text ledger: name + amount + percent. This carries the meaning so the
          insight never relies on the chart or on color alone. */}
      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {data.map((entry) => (
          <li
            key={entry.name}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: chartColor(entry.colorIndex) }}
            />
            <span className="min-w-0 flex-1 truncate">{entry.name}</span>
            <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
              {entry.percent.toFixed(0)}%
            </span>
            <AmountText value={entry.amount} size="sm" />
          </li>
        ))}
      </ul>
    </div>
  );
}
