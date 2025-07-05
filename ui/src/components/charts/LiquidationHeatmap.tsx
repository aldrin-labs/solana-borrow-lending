"use client";

import { FC } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface LiquidationData {
  healthFactor: number;
  collateralValue: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  token: string;
  count: number;
}

interface LiquidationHeatmapProps {
  data?: LiquidationData[];
  title: string;
  height?: number;
}

// Generate mock liquidation risk data
const generateLiquidationData = (): LiquidationData[] => {
  const tokens = ['SOL', 'ETH', 'BTC', 'USDC', 'USDT'];
  const data: LiquidationData[] = [];
  
  // Generate data points across different risk levels
  for (let i = 0; i < 50; i++) {
    const healthFactor = 1.0 + Math.random() * 2.5; // 1.0 to 3.5
    const collateralValue = Math.random() * 100000; // $0 to $100k
    
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (healthFactor < 1.2) {
      riskLevel = 'critical';
    } else if (healthFactor < 1.5) {
      riskLevel = 'high';
    } else if (healthFactor < 2.0) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }
    
    data.push({
      healthFactor: Math.round(healthFactor * 100) / 100,
      collateralValue: Math.round(collateralValue),
      riskLevel,
      token: tokens[Math.floor(Math.random() * tokens.length)],
      count: Math.floor(Math.random() * 20) + 1,
    });
  }
  
  return data;
};

export const LiquidationHeatmap: FC<LiquidationHeatmapProps> = ({ 
  data = generateLiquidationData(), 
  title, 
  height = 400 
}) => {
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return '#FF0000';
      case 'high': return '#FF6600';
      case 'medium': return '#FFFF00';
      case 'low': return '#00FF00';
      default: return '#808080';
    }
  };

  const formatValue = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="terminal-border bg-black p-3 border-2 border-primary">
          <p className="text-secondary font-bold terminal-text">
            LIQUIDATION RISK ANALYSIS
          </p>
          <p className="text-primary terminal-text">
            Token: {data.token}
          </p>
          <p className="text-primary terminal-text">
            Health Factor: {data.healthFactor}
          </p>
          <p className="text-primary terminal-text">
            Collateral: {formatValue(data.collateralValue)}
          </p>
          <p className="text-primary terminal-text">
            Positions: {data.count}
          </p>
          <p 
            className="font-bold terminal-text"
            style={{ color: getRiskColor(data.riskLevel) }}
          >
            Risk: {data.riskLevel.toUpperCase()}
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const size = Math.max(4, Math.min(20, payload.count * 2));
    
    return (
      <circle
        cx={cx}
        cy={cy}
        r={size}
        fill={getRiskColor(payload.riskLevel)}
        fillOpacity={0.7}
        stroke={getRiskColor(payload.riskLevel)}
        strokeWidth={1}
        className="animate-pulse"
      />
    );
  };

  // Calculate risk distribution
  const riskDistribution = data.reduce((acc, item) => {
    acc[item.riskLevel] = (acc[item.riskLevel] || 0) + item.count;
    return acc;
  }, {} as Record<string, number>);

  const totalPositions = Object.values(riskDistribution).reduce((sum, count) => sum + count, 0);

  return (
    <div className="card">
      <h3 className="section-subtitle mb-4">{title}</h3>
      
      {/* Risk Distribution Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stats-card">
          <div className="text-secondary text-xs terminal-text">CRITICAL RISK</div>
          <div className="text-error text-lg font-bold terminal-text">
            {riskDistribution.critical || 0}
          </div>
          <div className="text-error text-xs">
            {((riskDistribution.critical || 0) / totalPositions * 100).toFixed(1)}%
          </div>
        </div>
        
        <div className="stats-card">
          <div className="text-secondary text-xs terminal-text">HIGH RISK</div>
          <div className="text-warning text-lg font-bold terminal-text">
            {riskDistribution.high || 0}
          </div>
          <div className="text-warning text-xs">
            {((riskDistribution.high || 0) / totalPositions * 100).toFixed(1)}%
          </div>
        </div>
        
        <div className="stats-card">
          <div className="text-secondary text-xs terminal-text">MEDIUM RISK</div>
          <div className="text-secondary text-lg font-bold terminal-text">
            {riskDistribution.medium || 0}
          </div>
          <div className="text-secondary text-xs">
            {((riskDistribution.medium || 0) / totalPositions * 100).toFixed(1)}%
          </div>
        </div>
        
        <div className="stats-card">
          <div className="text-secondary text-xs terminal-text">LOW RISK</div>
          <div className="text-success text-lg font-bold terminal-text">
            {riskDistribution.low || 0}
          </div>
          <div className="text-success text-xs">
            {((riskDistribution.low || 0) / totalPositions * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Heatmap Chart */}
      <div className="mb-4">
        <div className="text-secondary text-sm mb-2 terminal-text">
          LIQUIDATION RISK HEATMAP - HEALTH FACTOR vs COLLATERAL VALUE
        </div>
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart
            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
            data={data}
          >
            <CartesianGrid strokeDasharray="1 1" stroke="#808080" />
            <XAxis
              type="number"
              dataKey="healthFactor"
              name="Health Factor"
              axisLine={{ stroke: "#00FF00" }}
              tickLine={{ stroke: "#00FF00" }}
              tick={{ fill: "#00FF00", fontFamily: "Courier New", fontSize: 12 }}
              domain={[1, 3.5]}
            />
            <YAxis
              type="number"
              dataKey="collateralValue"
              name="Collateral Value"
              axisLine={{ stroke: "#00FF00" }}
              tickLine={{ stroke: "#00FF00" }}
              tick={{ fill: "#00FF00", fontFamily: "Courier New", fontSize: 12 }}
              tickFormatter={formatValue}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Reference lines for risk thresholds */}
            <line
              x1="1.2"
              y1="0"
              x2="1.2"
              y2="100000"
              stroke="#FF0000"
              strokeDasharray="2 2"
              strokeWidth={2}
            />
            <line
              x1="1.5"
              y1="0"
              x2="1.5"
              y2="100000"
              stroke="#FF6600"
              strokeDasharray="2 2"
              strokeWidth={2}
            />
            <line
              x1="2.0"
              y1="0"
              x2="2.0"
              y2="100000"
              stroke="#FFFF00"
              strokeDasharray="2 2"
              strokeWidth={2}
            />
            
            <Scatter
              name="Positions"
              data={data}
              shape={<CustomDot />}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs terminal-text">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-error"></div>
          <span className="text-error">CRITICAL (&lt;1.2)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-warning"></div>
          <span className="text-warning">HIGH (1.2-1.5)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-secondary"></div>
          <span className="text-secondary">MEDIUM (1.5-2.0)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-success"></div>
          <span className="text-success">LOW (&gt;2.0)</span>
        </div>
      </div>
    </div>
  );
};