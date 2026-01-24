"use client";

import { memo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type StreakMiniChartProps = {
  data: Array<{ day: string; completed: number }>;
};

function StreakMiniChartComponent({ data }: StreakMiniChartProps) {
  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="streakGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} className="text-xs text-muted-foreground" />
          <YAxis hide domain={[0, "dataMax + 1"]} />
          <Tooltip
            cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.25 }}
            contentStyle={{ borderRadius: "0.9rem", borderColor: "hsl(var(--border))" }}
          />
          <Area type="monotone" dataKey="completed" stroke="hsl(var(--primary))" strokeWidth={2.4} fill="url(#streakGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export const StreakMiniChart = memo(StreakMiniChartComponent);
