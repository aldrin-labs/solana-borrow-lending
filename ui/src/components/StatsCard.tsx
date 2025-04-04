import { FC } from "react";

interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
}

export const StatsCard: FC<StatsCardProps> = ({
  title,
  value,
  change,
  isPositive,
}) => {
  return (
    <div className="stats-card hover:shadow-lg transition-shadow">
      <h3 className="text-text-secondary text-sm font-medium mb-2">{title}</h3>
      <div className="flex justify-between items-end">
        <p className="text-2xl font-bold text-white">{value}</p>
        <span
          className={`text-sm font-medium px-2 py-1 rounded-full ${
            isPositive ? "bg-success/10 text-success" : "bg-error/10 text-error"
          }`}
        >
          {change}
        </span>
      </div>
    </div>
  );
};
