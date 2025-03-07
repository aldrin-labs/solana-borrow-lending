import { FC } from 'react';

interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
}

export const StatsCard: FC<StatsCardProps> = ({ title, value, change, isPositive }) => {
  return (
    <div className="card">
      <h3 className="text-text-secondary text-sm font-medium mb-2">{title}</h3>
      <div className="flex justify-between items-end">
        <p className="text-2xl font-bold">{value}</p>
        <span className={`text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {change}
        </span>
      </div>
    </div>
  );
};