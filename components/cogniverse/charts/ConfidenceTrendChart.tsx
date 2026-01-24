"use client";

import { memo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ConfidenceTrendChartProps = {
  data: Array<{ label: string; confidence: number }>;
};

function ConfidenceTrendChartComponent({ data }: ConfidenceTrendChartProps) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 12 }}>
          <defs>
            <linearGradient id="confidenceArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={12} className="text-xs text-muted-foreground" />
          <YAxis tickLine={false} axisLine={false} width={36} domain={[40, 100]} className="text-xs text-muted-foreground" />
          <Tooltip contentStyle={{ borderRadius: "1rem", borderColor: "hsl(var(--border))" }} />
          <Area type="monotone" dataKey="confidence" stroke="hsl(var(--primary))" strokeWidth={2.8} fill="url(#confidenceArea)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export const ConfidenceTrendChart = memo(ConfidenceTrendChartComponent);
