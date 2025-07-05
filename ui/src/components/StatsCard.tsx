import { FC } from "react";
import { Tooltip } from "./Tooltip";

interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  subtitle?: string;
  valueClassName?: string;
  tooltip?: string;
}

export const StatsCard: FC<StatsCardProps> = ({
  title,
  value,
  change,
  isPositive,
  subtitle,
  valueClassName,
  tooltip,
}) => {
  const cardContent = (
    <div className="stats-card interactive">
      <div className="flex justify-between items-start mb-3">
        <h3 
          className="text-sm font-medium"
          style={{ color: 'var(--theme-textSecondary)' }}
        >
          {title}
        </h3>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
          isPositive 
            ? "status-positive" 
            : "status-negative"
        }`}>
          {change}
        </div>
      </div>
      
      <div className="space-y-1">
        <p 
          className={`text-3xl font-semibold ${valueClassName || ""}`}
          style={{ 
            color: valueClassName ? undefined : 'var(--theme-textPrimary)' 
          }}
        >
          {value}
        </p>
        {subtitle && (
          <p 
            className="text-sm"
            style={{ color: 'var(--theme-textSecondary)' }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} position="top">
        {cardContent}
      </Tooltip>
    );
  }

  return cardContent;
};
