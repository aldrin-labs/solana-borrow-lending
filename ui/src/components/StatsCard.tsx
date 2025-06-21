import { FC } from "react";

interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  subtitle?: string;
  valueClassName?: string;
}

export const StatsCard: FC<StatsCardProps> = ({
  title,
  value,
  change,
  isPositive,
  subtitle,
  valueClassName,
}) => {
  return (
    <div className="stats-card hover:shadow-lg transition-shadow">
      <h3 className="text-text-secondary text-sm font-medium mb-2">{title}</h3>
      <div className="flex justify-between items-end">
        <div>
          <p className={`text-2xl font-bold ${valueClassName || "text-white"}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-text-secondary mt-1">{subtitle}</p>
          )}
        </div>
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
