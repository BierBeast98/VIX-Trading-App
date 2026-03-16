"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface CorrelationPoint {
  date: string;
  vix: number;
  sp500Change: number;
}

interface CorrelationChartProps {
  data: CorrelationPoint[];
  height?: number;
}

export function CorrelationChart({ data, height = 260 }: CorrelationChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: (() => {
      try {
        return format(new Date(d.date), "d. MMM", { locale: de });
      } catch {
        return d.date;
      }
    })(),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={formatted} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E1E28" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#8B8FA8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="vix"
          orientation="left"
          tick={{ fill: "#8B8FA8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <YAxis
          yAxisId="sp500"
          orientation="right"
          tick={{ fill: "#8B8FA8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={45}
          tickFormatter={(v: number) => `${v.toFixed(1)}%`}
        />
        <Tooltip
          contentStyle={{ background: "#1A1A22", border: "1px solid #2E2E3A", borderRadius: "12px" }}
          labelStyle={{ color: "#8B8FA8" }}
          itemStyle={{ color: "#FFFFFF" }}
        />
        <Legend
          wrapperStyle={{ color: "#8B8FA8", fontSize: "12px", paddingTop: "12px" }}
        />
        <Bar
          yAxisId="sp500"
          dataKey="sp500Change"
          name="S&P 500 Änderung (%)"
          fill="#3B82F6"
          fillOpacity={0.6}
          radius={[2, 2, 0, 0]}
        />
        <Line
          yAxisId="vix"
          type="monotone"
          dataKey="vix"
          name="VIX"
          stroke="#B8E15A"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
