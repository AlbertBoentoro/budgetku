"use client";

import {
  Bar,
  BarChart,
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
  // Kept for API stability; bars now use one fill, so this is not rendered.
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

// Short axis labels so long Indonesian category names fit at 320px; the full
// name is always in the ledger below and in the tooltip.
function formatCategoryTick(name: string): string {
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
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
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-sm text-on-surface shadow-sm">
      <p className="font-medium">{item.name}</p>
      <p className="text-on-surface-variant">
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
            width={88}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatCategoryTick}
            tick={{ fill: "hsl(var(--on-surface-variant))", fontSize: 12 }}
          />
          <Tooltip
            content={<CategoryTooltip />}
            cursor={{ fill: "hsl(var(--surface-container))" }}
          />
          {/* One navy fill: categories are named by text, so a color cycle
              would carry no meaning. */}
          <Bar
            dataKey="amount"
            fill="hsl(var(--primary))"
            radius={[4, 4, 4, 4]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Text ledger: name + percent + amount. This carries the meaning so the
          breakdown never relies on the chart or on color alone. */}
      <ul className="flex flex-col divide-y divide-outline-variant">
        {data.map((entry) => (
          <li
            key={entry.name}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3"
          >
            <span className="min-w-0 flex-1 truncate text-body-md text-on-surface">
              {entry.name}
            </span>
            <span className="shrink-0 text-label-md text-on-surface-variant tabular-nums">
              {entry.percent.toFixed(0)}%
            </span>
            {/* Size on the wrapper: tailwind-merge treats text-currency-body
                as a color and would drop it next to text-on-surface. */}
            <span className="ml-auto text-currency-body">
              <AmountText
                value={entry.amount}
                size="none"
                className="text-on-surface"
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
