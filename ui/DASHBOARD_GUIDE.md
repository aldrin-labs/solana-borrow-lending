# Dashboard Developer Guide

This guide provides technical details for developers who want to extend or customize the analytics dashboard.

## Architecture Overview

The dashboard follows a modular architecture with reusable components and hooks:

```
ui/src/
├── components/
│   ├── Dashboard.tsx              # Main dashboard with tabs
│   ├── AnalyticsDashboard.tsx     # Analytics section with charts
│   ├── LendingDashboard.tsx       # Lender-focused dashboard
│   ├── BorrowingDashboard.tsx     # Borrower-focused dashboard
│   └── charts/                    # Reusable chart components
│       ├── TrendChart.tsx         # Line chart for trends
│       ├── UtilizationChart.tsx   # Area chart for utilization
│       └── APYComparisonChart.tsx # Bar chart for APY comparison
├── hooks/
│   └── useBorrowLending.ts        # Main data hook with analytics
└── types/                         # TypeScript type definitions
```

## Data Hook Interface

### `useBorrowLending()`

The main hook that provides all dashboard data:

```typescript
interface BorrowLendingData {
  isLoading: boolean;
  error: string | null;
  markets: Market[];
  suppliedPositions: Position[];
  borrowedPositions: Position[];
  analytics: ProtocolAnalytics;
  lastUpdated: Date;
}

interface ProtocolAnalytics {
  totalValueLocked: TrendData[];
  totalBorrowed: TrendData[];
  totalSupplied: TrendData[];
  utilizationTrend: UtilizationData[];
  apyComparison: APYData[];
  healthFactor: number;
  liquidationThreshold: number;
}
```

### Data Types

```typescript
interface TrendData {
  time: string;
  value: number;
}

interface UtilizationData {
  time: string;
  utilization: number;
}

interface APYData {
  token: string;
  supplyAPY: number;
  borrowAPY: number;
}
```

## Chart Components

### TrendChart

Displays time-series data as a line chart:

```typescript
interface TrendChartProps {
  data: TrendData[];
  title: string;
  color?: string;
  height?: number;
}
```

### UtilizationChart  

Shows utilization rates as an area chart:

```typescript
interface UtilizationChartProps {
  data: UtilizationData[];
  title: string;
  height?: number;
}
```

### APYComparisonChart

Compares supply vs borrow APY as a bar chart:

```typescript
interface APYComparisonChartProps {
  data: APYData[];
  title: string;
  height?: number;
}
```

## Analytics Dashboard

The `AnalyticsDashboard` component supports different user personas:

```typescript
interface AnalyticsDashboardProps {
  userType?: "lender" | "borrower" | "overview";
}
```

### User Type Features

- **"lender"**: Shows supply-focused metrics, lending analytics, interest tracking
- **"borrower"**: Displays health factor monitoring, liquidation risk, borrow capacity  
- **"overview"**: Provides protocol-wide statistics and market insights

## Real-time Updates

The dashboard implements simulated real-time updates:

```typescript
// Updates every 10 seconds when wallet is connected
useEffect(() => {
  if (!connected) return;
  
  const interval = setInterval(() => {
    // Update analytics data with small fluctuations
    setAnalytics(prev => ({
      ...prev,
      healthFactor: Math.max(1.0, prev.healthFactor + (Math.random() - 0.5) * 0.1),
      // ... other data updates
    }));
    setLastUpdated(new Date());
  }, 10000);
  
  return () => clearInterval(interval);
}, [connected]);
```

## Extending the Dashboard

### Adding New Charts

1. Create a new chart component in `src/components/charts/`:

```typescript
// src/components/charts/MyCustomChart.tsx
import { FC } from "react";
import { ResponsiveContainer, /* other imports */ } from "recharts";

interface MyCustomChartProps {
  data: any[];
  title: string;
  // ... other props
}

export const MyCustomChart: FC<MyCustomChartProps> = ({ data, title }) => {
  return (
    <div className="bg-surface rounded-lg p-4 border border-border">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        {/* Your chart implementation */}
      </ResponsiveContainer>
    </div>
  );
};
```

2. Export from `src/components/charts/index.ts`:

```typescript
export { MyCustomChart } from "./MyCustomChart";
```

3. Import and use in dashboard components:

```typescript
import { MyCustomChart } from "./charts";

// In your component render:
<MyCustomChart data={customData} title="My Custom Metric" />
```

### Adding New Metrics

1. Extend the analytics interface in your hook:

```typescript
const getProtocolAnalytics = () => {
  return {
    // ... existing analytics
    myCustomMetric: generateCustomData(),
  };
};
```

2. Update the component to display the new metric:

```typescript
{analytics.myCustomMetric && (
  <MyCustomChart 
    data={analytics.myCustomMetric} 
    title="My Custom Metric" 
  />
)}
```

## Styling Guidelines

The dashboard uses Tailwind CSS with a consistent design system:

### Colors
- `text-white`: Primary text
- `text-text-secondary`: Secondary text  
- `text-success`: Success/positive values (#10B981)
- `text-error`: Error/negative values (#EF4444)
- `text-warning`: Warning values (#F59E0B)
- `bg-surface`: Card backgrounds
- `border-border`: Border colors

### Components
- `card`: Standard card styling
- `stats-card`: Metrics card styling
- `table-container`: Table wrapper
- `btn-primary`: Primary button
- `btn-secondary`: Secondary button

## Testing

Run the test script to validate your changes:

```bash
./test-dashboard.sh
```

This script checks:
- TypeScript compilation
- Linting
- Build process
- Component file existence

## Performance Considerations

- Charts are responsive and optimize rendering
- Real-time updates are throttled to prevent excessive re-renders
- Data is memoized where appropriate
- Bundle size is optimized through tree-shaking

## Integration with On-Chain Data

To replace mock data with real on-chain data:

1. Replace the mock data generators in `useBorrowLending.ts`
2. Implement actual Solana program calls using `@solana/web3.js`
3. Add error handling for network issues
4. Implement proper caching and update strategies
5. Consider using WebSocket subscriptions for real-time updates

Example integration:

```typescript
// Replace mock data with real program calls
const fetchRealMarketData = async (connection: Connection) => {
  try {
    // Fetch from Solana programs
    const marketAccounts = await program.account.market.all();
    return marketAccounts.map(transformToMarketData);
  } catch (error) {
    console.error('Failed to fetch market data:', error);
    throw error;
  }
};
```