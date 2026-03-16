"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
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

interface CertificateIntradayChartProps {
  data: DataPoint[];
  entryPrice?: number;
  height?: number;
  direction?: "long" | "short";
  name?: string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    const bid = payload.find((p) => p.dataKey === "close");
    return (
      <div
        className="rounded-xl border p-3 text-sm shadow-xl"
        style={{ background: "#1A1A22", borderColor: "#2E2E3A" }}
      >
        {bid && (
          <p className="font-medium mb-0.5" style={{ color: "#60A5FA" }}>
            Bid: {bid.value.toFixed(2)} EUR
          </p>
        )}
        <p style={{ color: "#8B8FA8" }}>{label}</p>
      </div>
    );
  }
  return null;
};

export function CertificateIntradayChart({
  data,
  entryPrice,
  height = 200,
  direction = "short",
  name,
}: CertificateIntradayChartProps) {
  // Helper: get CET date string
  const getCetDateStr = (dt: Date) =>
    dt.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

  const getCetMinutes = (dt: Date) => {
    const cetStr = dt.toLocaleString("en-US", { timeZone: "Europe/Berlin" });
    const cetDate = new Date(cetStr);
    return cetDate.getHours() * 60 + cetDate.getMinutes();
  };

  // Find last trading day
  const lastTradingDay = (() => {
    const dates = data.map((d) => getCetDateStr(new Date(d.date)));
    const unique = [...new Set(dates)].sort();
    return unique[unique.length - 1] ?? null;
  })();

  // Filter to last trading day, 08:00–22:00 CET
  const filtered = lastTradingDay
    ? data.filter((d) => {
        try {
          const dt = new Date(d.date);
          if (getCetDateStr(dt) !== lastTradingDay) return false;
          const totalMin = getCetMinutes(dt);
          return totalMin >= 8 * 60 && totalMin <= 22 * 60;
        } catch { return false; }
      })
    : data;

  const formatted = filtered.map((d) => ({
    ...d,
    label: (() => {
      try { return format(new Date(d.date), "HH:mm", { locale: de }); }
      catch { return d.date; }
    })(),
  }));

  // Add boundary padding
  if (formatted.length > 0) {
    if (formatted[0].label > "08:00") {
      formatted.unshift({ date: "", close: null as any, label: "08:00" });
    }
    if (formatted[formatted.length - 1].label < "22:00") {
      formatted.push({ date: "", close: null as any, label: "22:00" });
    }
  }

  if (formatted.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p style={{ color: "#8B8FA8", fontSize: 13 }}>Keine Zertifikat-Daten verfügbar</p>
      </div>
    );
  }

  const values = formatted.map((d) => d.close).filter((v) => v > 0);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const range = dataMax - dataMin || 0.1;
  const padding = Math.max(range * 0.08, 0.02);
  // Include entry price only if it's close to data range (within 50% of range)
  const effectiveMin = entryPrice && entryPrice >= dataMin - range * 0.5
    ? Math.min(dataMin, entryPrice) : dataMin;
  const minVal = effectiveMin - padding;
  const maxVal = dataMax + padding;

  // Determine color based on P&L direction
  const lastPrice = values[values.length - 1] ?? 0;
  const isProfit = entryPrice ? (direction === "short" ? lastPrice < entryPrice : lastPrice > entryPrice) : true;
  const chartColor = isProfit ? "#B8E15A" : "#EF4444";

  return (
    <div>
      {name && (
        <p className="text-xs mb-2 px-1" style={{ color: "#8B8FA8" }}>
          {name} ({direction === "short" ? "Short" : "Long"})
        </p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={formatted} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="certGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.25} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E1E28" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#8B8FA8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minVal, maxVal]}
            allowDataOverflow={true}
            tickCount={5}
            tick={{ fill: "#8B8FA8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={42}
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <Tooltip content={<CustomTooltip />} />
          {entryPrice && (
            <ReferenceLine
              y={entryPrice}
              stroke="#8B8FA8"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: `Entry ${entryPrice.toFixed(2)}`,
                position: "right",
                fill: "#8B8FA8",
                fontSize: 10,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="close"
            stroke={chartColor}
            strokeWidth={2}
            fill="url(#certGradient)"
            dot={false}
            activeDot={{ r: 4, fill: chartColor, stroke: "#0C0C0F", strokeWidth: 2 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
