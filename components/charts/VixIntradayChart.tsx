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
} from "recharts";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface DataPoint {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
}

interface VixIntradayChartProps {
  data: DataPoint[];
  futuresData?: DataPoint[];
  height?: number;
  minimal?: boolean;
}

interface TooltipPayload {
  value: number;
  dataKey: string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    const spot = payload.find((p) => p.dataKey === "close");
    const fut = payload.find((p) => p.dataKey === "futures");
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
            VIX Future: {(fut.value as number).toFixed(2)}
          </p>
        )}
        <p style={{ color: "#8B8FA8" }}>{label}</p>
      </div>
    );
  }
  return null;
};

export function VixIntradayChart({
  data,
  futuresData = [],
  height = 200,
  minimal = false,
}: VixIntradayChartProps) {
  // Helper: get CET total minutes for a Date
  const getCetMinutes = (dt: Date) => {
    // CET = UTC+1 (winter) / CEST = UTC+2 (summer)
    // Use Intl to get actual CET offset
    const cetStr = dt.toLocaleString("en-US", { timeZone: "Europe/Berlin" });
    const cetDate = new Date(cetStr);
    return cetDate.getHours() * 60 + cetDate.getMinutes();
  };

  const getCetDateStr = (dt: Date) => {
    return dt.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }); // YYYY-MM-DD
  };

  // Find the last trading day (most recent date with data)
  const lastTradingDay = (() => {
    const dates = data.map((d) => getCetDateStr(new Date(d.date)));
    const unique = [...new Set(dates)].sort();
    return unique[unique.length - 1] ?? null;
  })();

  // Filter to last trading day, 08:30–22:30 CET
  const filterSession = (arr: DataPoint[]) => {
    if (!lastTradingDay) return arr;
    return arr.filter((d) => {
      try {
        const dt = new Date(d.date);
        if (getCetDateStr(dt) !== lastTradingDay) return false;
        const totalMin = getCetMinutes(dt);
        return totalMin >= 8 * 60 + 30 && totalMin <= 22 * 60 + 30;
      } catch { return false; }
    });
  };

  const spotData = filterSession(data);
  const futData = filterSession(futuresData);

  // Build futures lookup by date key (ISO string minute-precision match)
  const futuresMap = new Map(futData.map((d) => [d.date, d.close]));

  // Build formatted data with boundary padding at 08:30 and 22:30
  const formatted = spotData.map((d) => ({
    ...d,
    futures: futuresMap.get(d.date) ?? null,
    label: (() => {
      try { return format(new Date(d.date), "HH:mm", { locale: de }); }
      catch { return d.date; }
    })(),
  }));

  // Add small x-axis padding (30 min before first / after last data point)
  // Only extend to 08:30/22:30 if data is already within 2h of those boundaries
  if (formatted.length > 0) {
    const firstLabel = formatted[0].label;
    const lastLabel = formatted[formatted.length - 1].label;
    // Pad left: use 08:30 if data starts before 10:30, otherwise 30min before first point
    if (firstLabel <= "10:30") {
      if (firstLabel > "08:30") {
        formatted.unshift({ date: "", close: null as any, futures: null, label: "08:30" });
      }
    } else {
      // Calculate 30 min before first data point
      const [h, m] = firstLabel.split(":").map(Number);
      const padMin = h * 60 + m - 30;
      const padLabel = `${String(Math.floor(padMin / 60)).padStart(2, "0")}:${String(padMin % 60).padStart(2, "0")}`;
      formatted.unshift({ date: "", close: null as any, futures: null, label: padLabel });
    }
    // Pad right: use 22:30 if data ends after 20:30, otherwise 30min after last point
    if (lastLabel >= "20:30") {
      if (lastLabel < "22:30") {
        formatted.push({ date: "", close: null as any, futures: null, label: "22:30" });
      }
    } else {
      const [h, m] = lastLabel.split(":").map(Number);
      const padMin = h * 60 + m + 30;
      const padLabel = `${String(Math.floor(padMin / 60)).padStart(2, "0")}:${String(padMin % 60).padStart(2, "0")}`;
      formatted.push({ date: "", close: null as any, futures: null, label: padLabel });
    }
  }

  if (formatted.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p style={{ color: "#8B8FA8", fontSize: 13 }}>Keine Intraday-Daten verfügbar</p>
      </div>
    );
  }

  const allValues = [
    ...formatted.map((d) => d.close),
    ...futData.map((d) => d.close),
  ].filter((v) => v > 0);

  const minVal = Math.min(...allValues) - 0.15;
  const maxVal = Math.max(...allValues) + 0.15;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={formatted} margin={minimal ? { top: 2, right: 2, bottom: 2, left: 2 } : { top: 5, right: 10, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="intradayGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#B8E15A" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#B8E15A" stopOpacity={0} />
          </linearGradient>
        </defs>
        {!minimal && <CartesianGrid strokeDasharray="3 3" stroke="#1E1E28" vertical={false} />}
        <XAxis
          dataKey="label"
          tick={minimal ? false : { fill: "#8B8FA8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          hide={minimal}
        />
        <YAxis
          domain={[minVal, maxVal]}
          allowDataOverflow={true}
          tickCount={5}
          tick={minimal ? false : { fill: "#8B8FA8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={minimal ? 0 : 36}
          tickFormatter={(v: number) => v.toFixed(1)}
          hide={minimal}
        />
        {!minimal && <Tooltip content={<CustomTooltip />} />}
        {/* VIX Spot — filled area */}
        <Area
          type="monotone"
          dataKey="close"
          stroke="#B8E15A"
          strokeWidth={minimal ? 1.5 : 2}
          fill="url(#intradayGradient)"
          dot={false}
          activeDot={minimal ? false : { r: 4, fill: "#B8E15A", stroke: "#0C0C0F", strokeWidth: 2 }}
          connectNulls
        />
        {/* VIX 3M intraday — amber line, futures proxy */}
        {!minimal && futuresData.length > 0 && (
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
