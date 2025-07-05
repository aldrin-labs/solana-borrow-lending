import { FC, useState, useEffect } from "react";
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
  const [isUpdating, setIsUpdating] = useState(false);

  // Flash animation when value changes
  useEffect(() => {
    setIsUpdating(true);
    const timer = setTimeout(() => setIsUpdating(false), 300);
    return () => clearTimeout(timer);
  }, [value]);

  const cardContent = (
    <div className={`stats-card interactive ${isUpdating ? 'animate-pulse-soft' : ''}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="typography-caption mb-1">{title}</div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
            <span className="typography-body-sm opacity-75">Live</span>
          </div>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
          isPositive 
            ? "status-positive" 
            : "status-negative"
        }`}>
          <svg 
            className={`w-3 h-3 ${isPositive ? 'rotate-0' : 'rotate-180'}`} 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path 
              fillRule="evenodd" 
              d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" 
              clipRule="evenodd" 
            />
          </svg>
          <span className="typography-number-sm">{change}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <div 
          className={`typography-number-lg font-semibold ${valueClassName || ""}`}
          style={{ 
            color: valueClassName ? undefined : 'var(--theme-textPrimary)',
            fontSize: '2rem',
            lineHeight: '1.1'
          }}
        >
          {value}
        </div>
        {subtitle && (
          <div className="typography-body-sm">
            {subtitle}
          </div>
        )}
        
        {/* Enhanced information display */}
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="typography-caption">24H RANGE</span>
            <div className="flex items-center gap-2">
              <div className="w-12 h-1 bg-surface rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-error via-warning to-success rounded-full"
                  style={{ width: '60%' }}
                ></div>
              </div>
              <span className="typography-body-sm opacity-75">60%</span>
            </div>
          </div>
        </div>
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
