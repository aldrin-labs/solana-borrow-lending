"use client";

import { FC } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface UtilizationChartProps {
  data: Array<{
    time: string;
    utilization: number;
  }>;
  title: string;
  height?: number;
}

export const UtilizationChart: FC<UtilizationChartProps> = ({
  data,
  title,
  height = 200,
}) => {
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  return (
    <div className="bg-surface rounded-lg p-4 border border-border">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="utilizationGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#9CA3AF", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#9CA3AF", fontSize: 12 }}
            tickFormatter={formatPercentage}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "1px solid #374151",
              borderRadius: "6px",
              color: "#F9FAFB",
            }}
            formatter={(value: number) => [formatPercentage(value), "Utilization"]}
            labelStyle={{ color: "#9CA3AF" }}
          />
          <Area
            type="monotone"
            dataKey="utilization"
            stroke="#3B82F6"
            fillOpacity={1}
            fill="url(#utilizationGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};