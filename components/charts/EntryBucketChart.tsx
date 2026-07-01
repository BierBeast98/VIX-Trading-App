"use client";

import { memo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

interface EntryBucket {
  range: string;
  count: number;
  avgReturn: number;
  winRate: number;
}

interface EntryBucketChartProps {
  data: EntryBucket[];
  height?: number;
}

function EntryBucketChartInner({ data, height = 200 }: EntryBucketChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E1E28" vertical={false} />
        <XAxis dataKey="range" tick={{ fill: "#8B8FA8", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#8B8FA8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
        <Tooltip
          contentStyle={{ background: "#1A1A22", border: "1px solid #2E2E3A", borderRadius: "12px" }}
          labelStyle={{ color: "#8B8FA8" }}
          formatter={(value: any) => [`${Number(value).toFixed(1)}%`, "Ø Rendite"]}
        />
        <Bar dataKey="avgReturn" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.avgReturn >= 0 ? "#B8E15A" : "#FF4D4D"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const EntryBucketChart = memo(EntryBucketChartInner);
