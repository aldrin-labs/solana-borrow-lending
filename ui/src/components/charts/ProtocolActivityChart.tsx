"use client";

import { FC } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  ReferenceLine,
} from "recharts";

interface ProtocolActivityData {
  time: string;
  totalVolumeUSD: number;
  borrowVolume: number;
  lendVolume: number;
  liquidationVolume: number;
  uniqueUsers: number;
  avgTransactionSize: number;
  protocolRevenue: number;
}

interface ProtocolActivityChartProps {
  data: ProtocolActivityData[];
  title: string;
  height?: number;
}

// Generate mock protocol activity data for demo
const generateProtocolActivityData = (): ProtocolActivityData[] => {
  const data = [];
  const now = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const baseVolume = 50000000 + Math.random() * 30000000; // $50-80M daily volume
    
    data.push({
      time: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      totalVolumeUSD: Math.round(baseVolume),
      borrowVolume: Math.round(baseVolume * 0.4 + Math.random() * baseVolume * 0.2),
      lendVolume: Math.round(baseVolume * 0.5 + Math.random() * baseVolume * 0.2),
      liquidationVolume: Math.round(baseVolume * 0.02 + Math.random() * baseVolume * 0.03),
      uniqueUsers: Math.round(5000 + Math.random() * 3000),
      avgTransactionSize: Math.round(10000 + Math.random() * 20000),
      protocolRevenue: Math.round(baseVolume * 0.001 + Math.random() * baseVolume * 0.002), // 0.1-0.3% fee
    });
  }
  
  return data;
};

export const ProtocolActivityChart: FC<ProtocolActivityChartProps> = ({ 
  data = generateProtocolActivityData(), 
  title, 
  height = 400 
}) => {
  const formatValue = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatUsers = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="terminal-border bg-black p-3 border-2 border-primary">
          <p className="text-secondary font-bold">{`Date: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-primary">
              {`${entry.name}: ${
                entry.name.includes('Users') 
                  ? formatUsers(entry.value)
                  : formatValue(entry.value)
              }`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card">
      <h3 className="section-subtitle mb-4">{title}</h3>
      
      {/* Volume Chart */}
      <div className="mb-6">
        <h4 className="text-secondary text-sm mb-2 terminal-text">DAILY VOLUME BREAKDOWN</h4>
        <ResponsiveContainer width="100%" height={height * 0.6}>
          <ComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="1 1" stroke="#808080" />
            <XAxis 
              dataKey="time" 
              axisLine={{ stroke: "#00FF00" }}
              tickLine={{ stroke: "#00FF00" }}
              tick={{ fill: "#00FF00", fontFamily: "Courier New", fontSize: 12 }}
            />
            <YAxis 
              axisLine={{ stroke: "#00FF00" }}
              tickLine={{ stroke: "#00FF00" }}
              tick={{ fill: "#00FF00", fontFamily: "Courier New", fontSize: 12 }}
              tickFormatter={formatValue}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ 
                color: "#00FF00", 
                fontFamily: "Courier New", 
                fontSize: "12px" 
              }}
            />
            
            {/* Area for total volume */}
            <Area
              type="monotone"
              dataKey="totalVolumeUSD"
              name="Total Volume"
              stroke="#00FF00"
              fill="rgba(0, 255, 0, 0.1)"
              strokeWidth={2}
            />
            
            {/* Lines for individual volumes */}
            <Line
              type="monotone"
              dataKey="borrowVolume"
              name="Borrow Volume"
              stroke="#FFFF00"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="lendVolume"
              name="Lend Volume"
              stroke="#00FFFF"
              strokeWidth={2}
              dot={false}
            />
            
            {/* Bar for liquidations */}
            <Bar
              dataKey="liquidationVolume"
              name="Liquidations"
              fill="#FF0000"
              fillOpacity={0.7}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* User Activity Chart */}
      <div className="mb-6">
        <h4 className="text-secondary text-sm mb-2 terminal-text">USER ACTIVITY METRICS</h4>
        <ResponsiveContainer width="100%" height={height * 0.4}>
          <ComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="1 1" stroke="#808080" />
            <XAxis 
              dataKey="time" 
              axisLine={{ stroke: "#00FF00" }}
              tickLine={{ stroke: "#00FF00" }}
              tick={{ fill: "#00FF00", fontFamily: "Courier New", fontSize: 12 }}
            />
            <YAxis 
              yAxisId="users"
              orientation="left"
              axisLine={{ stroke: "#FFFF00" }}
              tickLine={{ stroke: "#FFFF00" }}
              tick={{ fill: "#FFFF00", fontFamily: "Courier New", fontSize: 12 }}
              tickFormatter={formatUsers}
            />
            <YAxis 
              yAxisId="revenue"
              orientation="right"
              axisLine={{ stroke: "#FF00FF" }}
              tickLine={{ stroke: "#FF00FF" }}
              tick={{ fill: "#FF00FF", fontFamily: "Courier New", fontSize: 12 }}
              tickFormatter={formatValue}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ 
                color: "#00FF00", 
                fontFamily: "Courier New", 
                fontSize: "12px" 
              }}
            />
            
            <Bar
              yAxisId="users"
              dataKey="uniqueUsers"
              name="Daily Active Users"
              fill="#FFFF00"
              fillOpacity={0.6}
            />
            <Line
              yAxisId="revenue"
              type="monotone"
              dataKey="protocolRevenue"
              name="Protocol Revenue"
              stroke="#FF00FF"
              strokeWidth={3}
              dot={{ fill: "#FF00FF", strokeWidth: 2, r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Real-time Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        <div className="stats-card">
          <div className="text-secondary text-xs terminal-text">24H VOLUME</div>
          <div className="text-primary text-lg font-bold terminal-text">
            {formatValue(data[data.length - 1]?.totalVolumeUSD || 0)}
          </div>
          <div className="text-success text-xs">+12.5%</div>
        </div>
        
        <div className="stats-card">
          <div className="text-secondary text-xs terminal-text">ACTIVE USERS</div>
          <div className="text-primary text-lg font-bold terminal-text">
            {formatUsers(data[data.length - 1]?.uniqueUsers || 0)}
          </div>
          <div className="text-warning text-xs">+8.2%</div>
        </div>
        
        <div className="stats-card">
          <div className="text-secondary text-xs terminal-text">AVG TX SIZE</div>
          <div className="text-primary text-lg font-bold terminal-text">
            {formatValue(data[data.length - 1]?.avgTransactionSize || 0)}
          </div>
          <div className="text-error text-xs">-3.1%</div>
        </div>
        
        <div className="stats-card">
          <div className="text-secondary text-xs terminal-text">PROTOCOL REV</div>
          <div className="text-primary text-lg font-bold terminal-text">
            {formatValue(data[data.length - 1]?.protocolRevenue || 0)}
          </div>
          <div className="text-success text-xs">+15.7%</div>
        </div>
      </div>
    </div>
  );
};