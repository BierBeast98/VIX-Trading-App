"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useMemo } from "react";
import type { BacktestTrade } from "@/lib/analytics";

interface Props {
  history: { date: string; close: number }[];
  trades: BacktestTrade[];
}

interface ChartPoint {
  date: string;
  close: number;
  label: string;
  isEntry: boolean;
  exitTrade: BacktestTrade | null;
}

// Custom dot renderer: only renders markers at entry/exit points
const TradeMarker = (props: {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
}) => {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;

  if (payload.isEntry) {
    return (
      <circle
        key={`entry-${payload.date}`}
        cx={cx}
        cy={cy}
        r={5}
        fill="#22C55E"
        stroke="#0C0C0F"
        strokeWidth={1.5}
      />
    );
  }

  if (payload.exitTrade) {
    const col = payload.exitTrade.returnPct >= 0 ? "#22C55E" : "#EF4444";
    return (
      <g key={`exit-${payload.date}`}>
        <line
          x1={cx - 4}
          y1={cy - 4}
          x2={cx + 4}
          y2={cy + 4}
          stroke={col}
          strokeWidth={2.5}
        />
        <line
          x1={cx + 4}
          y1={cy - 4}
          x2={cx - 4}
          y2={cy + 4}
          stroke={col}
          strokeWidth={2.5}
        />
      </g>
    );
  }

  return null;
};

// Custom tooltip: only shows content at entry/exit points
const ChartTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
}) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  if (!d.isEntry && !d.exitTrade) return null;

  let dateLabel = d.date;
  try {
    dateLabel = format(new Date(d.date), "d. MMM yyyy", { locale: de });
  } catch { /* noop */ }

  return (
    <div
      style={{
        background: "#141418",
        border: "1px solid #1E1E28",
        padding: "8px 12px",
        borderRadius: 6,
        fontSize: 13,
      }}
    >
      <p style={{ color: "#8B8FA8", fontSize: 12, margin: 0 }}>{dateLabel}</p>
      <p style={{ color: "#B8E15A", margin: "3px 0" }}>VIX {d.close.toFixed(2)}</p>
      {d.isEntry && (
        <p style={{ color: "#22C55E", fontSize: 12, margin: 0 }}>● Einstieg</p>
      )}
      {d.exitTrade && (
        <>
          <p
            style={{
              color: d.exitTrade.returnPct >= 0 ? "#22C55E" : "#EF4444",
              fontSize: 12,
              margin: "3px 0 0",
            }}
          >
            ✕ Ausstieg{" "}
            {d.exitTrade.returnPct >= 0 ? "+" : ""}
            {d.exitTrade.returnPct.toFixed(1)}%
          </p>
          <p style={{ color: "#8B8FA8", fontSize: 11, margin: "2px 0 0" }}>
            {d.exitTrade.exitReason === "trailing_stop"
              ? "Trailing Stop"
              : "Max Haltetage"}{" "}
            · {d.exitTrade.holdDays} Tage
          </p>
        </>
      )}
    </div>
  );
};

export function BacktestTradeChart({ history, trades }: Props) {
  const chartData = useMemo((): ChartPoint[] => {
    const entrySet = new Set(trades.map((t) => t.entryDate));
    const exitMap = new Map(trades.map((t) => [t.exitDate, t]));

    // Deduplicate labels so each month appears only once (1y period → M/yy)
    const seenLabels = new Set<string>();

    return history.map((h) => {
      let rawLabel = "";
      try {
        rawLabel = format(new Date(h.date), "M/yy", { locale: de });
      } catch { /* noop */ }

      const label = seenLabels.has(rawLabel) ? "" : rawLabel;
      if (rawLabel) seenLabels.add(rawLabel);

      return {
        date: h.date,
        close: h.close,
        label,
        isEntry: entrySet.has(h.date),
        exitTrade: exitMap.get(h.date) ?? null,
      };
    });
  }, [history, trades]);

  // Limit to ~5 visible ticks
  const tickFilteredData = useMemo(() => {
    const TARGET_TICKS = 5;
    const nonEmptyIndices = chartData
      .map((d, i) => (d.label !== "" ? i : -1))
      .filter((i) => i >= 0);
    const step = Math.max(1, Math.floor(nonEmptyIndices.length / TARGET_TICKS));
    const visibleSet = new Set<number>();
    if (nonEmptyIndices.length > 0) {
      visibleSet.add(nonEmptyIndices[0]);
      visibleSet.add(nonEmptyIndices[nonEmptyIndices.length - 1]);
      for (let i = 0; i < nonEmptyIndices.length; i += step) {
        visibleSet.add(nonEmptyIndices[i]);
      }
    }
    return chartData.map((d, i) => ({
      ...d,
      label: visibleSet.has(i) ? d.label : "",
    }));
  }, [chartData]);

  const allValues = history.map((h) => h.close).filter((v) => v > 0);
  const minVal = allValues.length ? Math.min(...allValues) - 1 : 0;
  const maxVal = allValues.length ? Math.max(...allValues) + 1 : 100;

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart
          data={tickFilteredData}
          margin={{ top: 5, right: 5, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#1E1E28"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "#8B8FA8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={0}
            tickFormatter={(v: string) => v}
          />
          <YAxis
            domain={[minVal, maxVal]}
            tick={{ fill: "#8B8FA8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v: number) => v.toFixed(1)}
          />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="close"
            stroke="#B8E15A"
            strokeWidth={1.5}
            dot={<TradeMarker />}
            activeDot={{ r: 3, fill: "#B8E15A" }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 20,
          marginTop: 8,
          fontSize: 12,
          color: "#8B8FA8",
          paddingLeft: 36,
        }}
      >
        <span>
          <span style={{ color: "#22C55E" }}>●</span> Einstieg
        </span>
        <span>
          <span style={{ color: "#22C55E", fontWeight: 700 }}>✕</span> Ausstieg
          (Gewinn)
        </span>
        <span>
          <span style={{ color: "#EF4444", fontWeight: 700 }}>✕</span> Ausstieg
          (Verlust)
        </span>
      </div>
    </div>
  );
}
