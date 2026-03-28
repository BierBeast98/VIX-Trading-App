"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface DataPoint {
  date: string;
  close: number;
}

interface VixHistoryChartProps {
  data: DataPoint[];
  futuresData?: DataPoint[];
  threshold?: number;
  height?: number;
  period?: string;
}

interface TooltipPayload {
  value: number;
  dataKey: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: (TooltipPayload & { payload?: { date?: string } })[];
  label?: string;
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    const spot = payload.find((p) => p.dataKey === "close");
    const fut = payload.find((p) => p.dataKey === "futures");
    const rawDate = payload[0]?.payload?.date;
    let dateLabel = "";
    try {
      if (rawDate) dateLabel = format(new Date(rawDate), "d. MMM yyyy", { locale: de });
    } catch { /* noop */ }
    return (
      <div
        className="rounded-xl border p-3 text-sm shadow-xl"
        style={{ background: "#1A1A22", borderColor: "#2E2E3A" }}
      >
        {spot && (
          <p className="font-medium mb-0.5" style={{ color: "#B8E15A" }}>
            VIX Spot: {spot.value.toFixed(2)}
          </p>
        )}
        {fut && fut.value != null && (
          <p className="font-medium mb-0.5" style={{ color: "#F59E0B" }}>
            VIX 3M: {(fut.value as number).toFixed(2)}
          </p>
        )}
        {dateLabel && <p style={{ color: "#8B8FA8" }}>{dateLabel}</p>}
      </div>
    );
  }
  return null;
};

export function VixHistoryChart({
  data,
  futuresData = [],
  threshold = 15,
  height = 280,
  period = "1m",
}: VixHistoryChartProps) {
  const isLongPeriod = ["5y", "10y"].includes(period);
  const isMediumPeriod = ["1y", "3m"].includes(period);

  const labelFormat = (isLongPeriod || isMediumPeriod) ? "M/yy" : "d.M.";

  // Build date → futures price lookup for O(1) merge
  const futuresMap = new Map(futuresData.map((d) => [d.date, d.close]));

  const formatted = data.map((d) => ({
    ...d,
    futures: futuresMap.get(d.date) ?? null,
    label: (() => {
      try {
        return format(new Date(d.date), labelFormat, { locale: de });
      } catch {
        return d.date;
      }
    })(),
  }));

  const allValues = [
    ...data.map((d) => d.close),
    ...futuresData.map((d) => d.close),
  ].filter((v) => v > 0);

  const minVal = allValues.length ? Math.min(...allValues) - 1 : 0;
  const maxVal = allValues.length ? Math.max(...allValues) + 1 : 100;

  // Build evenly-spaced tick dates (~5 visible) using unique labels as anchors
  const TARGET_TICKS = 5;
  const uniqueLabelDates: string[] = [];
  const seenLabels = new Set<string>();
  for (const d of formatted) {
    if (d.label && !seenLabels.has(d.label)) {
      seenLabels.add(d.label);
      uniqueLabelDates.push(d.date);
    }
  }
  const tickStep = Math.max(1, Math.floor(uniqueLabelDates.length / TARGET_TICKS));
  const visibleTicks: string[] = [];
  for (let i = 0; i < uniqueLabelDates.length; i += tickStep) {
    visibleTicks.push(uniqueLabelDates[i]);
  }
  if (uniqueLabelDates.length > 0) {
    const last = uniqueLabelDates[uniqueLabelDates.length - 1];
    if (visibleTicks[visibleTicks.length - 1] !== last) visibleTicks.push(last);
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={formatted} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="vixGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#B8E15A" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#B8E15A" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#1E1E28"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          ticks={visibleTicks}
          tick={{ fill: "#8B8FA8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(dateStr: string) => {
            try { return format(new Date(dateStr), labelFormat, { locale: de }); }
            catch { return ""; }
          }}
        />
        <YAxis
          domain={[minVal, maxVal]}
          tick={{ fill: "#8B8FA8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
          tickFormatter={(v: number) => v.toFixed(1)}
        />
        <Tooltip content={<CustomTooltip />} />
        {threshold && (
          <ReferenceLine
            y={threshold}
            stroke="#B8E15A"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
            label={{
              value: `Alert: ${threshold}`,
              fill: "#B8E15A",
              fontSize: 11,
              position: "right",
            }}
          />
        )}
        {/* VIX Spot — filled area */}
        <Area
          type="monotone"
          dataKey="close"
          stroke="#B8E15A"
          strokeWidth={2}
          fill="url(#vixGradient)"
          dot={false}
          activeDot={{ r: 4, fill: "#B8E15A", stroke: "#0C0C0F", strokeWidth: 2 }}
          connectNulls
        />
        {/* VIX 3M (futures proxy) — line only, amber */}
        {futuresData.length > 0 && (
          <Line
            type="monotone"
            dataKey="futures"
            stroke="#F59E0B"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: "#F59E0B", stroke: "#0C0C0F", strokeWidth: 2 }}
            connectNulls
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
