"use client";

import { FC } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface APYComparisonChartProps {
  data: Array<{
    token: string;
    supplyAPY: number;
    borrowAPY: number;
  }>;
  title: string;
  height?: number;
}

export const APYComparisonChart: FC<APYComparisonChartProps> = ({
  data,
  title,
  height = 250,
}) => {
  const formatPercentage = (value: number) => `${value.toFixed(2)}%`;

  return (
    <div className="bg-surface rounded-lg p-4 border border-border">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="token"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#9CA3AF", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#9CA3AF", fontSize: 12 }}
            tickFormatter={formatPercentage}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "1px solid #374151",
              borderRadius: "6px",
              color: "#F9FAFB",
            }}
            formatter={(value: number, name: string) => [
              formatPercentage(value),
              name === "supplyAPY" ? "Supply APY" : "Borrow APY",
            ]}
            labelStyle={{ color: "#9CA3AF" }}
          />
          <Bar dataKey="supplyAPY" fill="#10B981" name="supplyAPY" radius={[2, 2, 0, 0]} />
          <Bar dataKey="borrowAPY" fill="#EF4444" name="borrowAPY" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};