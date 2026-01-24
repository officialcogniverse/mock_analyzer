"use client";

import { memo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type AttemptTrendPoint = {
  name: string;
  score: number;
  accuracy: number;
  speed: number;
};

type AttemptTrendChartProps = {
  data: AttemptTrendPoint[];
};

function AttemptTrendChartComponent({ data }: AttemptTrendChartProps) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 24, left: 0, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={12} className="text-xs text-muted-foreground" />
          <YAxis tickLine={false} axisLine={false} width={36} className="text-xs text-muted-foreground" />
          <Tooltip contentStyle={{ borderRadius: "1rem", borderColor: "hsl(var(--border))" }} />
          <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--chart-2))" strokeWidth={2.4} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="speed" stroke="hsl(var(--chart-3))" strokeWidth={2.2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export const AttemptTrendChart = memo(AttemptTrendChartComponent);
