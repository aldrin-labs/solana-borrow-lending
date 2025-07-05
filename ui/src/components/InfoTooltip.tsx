"use client";

import { FC, ReactNode, useState, useRef, useEffect, useCallback } from "react";

interface InfoTooltipProps {
  content: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  trigger?: "hover" | "click";
  className?: string;
  children?: ReactNode;
}

export const InfoTooltip: FC<InfoTooltipProps> = ({
  content,
  position = "top",
  trigger = "hover",
  className = "",
  children,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    let top = 0;
    let left = 0;

    switch (position) {
      case "top":
        top = triggerRect.top - tooltipRect.height - 8;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case "bottom":
        top = triggerRect.bottom + 8;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case "left":
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - 8;
        break;
      case "right":
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + 8;
        break;
    }

    // Ensure tooltip stays within viewport
    if (left < 8) left = 8;
    if (left + tooltipRect.width > viewport.width - 8) {
      left = viewport.width - tooltipRect.width - 8;
    }
    if (top < 8) top = 8;
    if (top + tooltipRect.height > viewport.height - 8) {
      top = viewport.height - tooltipRect.height - 8;
    }

    setTooltipPosition({ top, left });
  }, [position]);

  useEffect(() => {
    if (isVisible) {
      calculatePosition();
      window.addEventListener("resize", calculatePosition);
      window.addEventListener("scroll", calculatePosition);
      return () => {
        window.removeEventListener("resize", calculatePosition);
        window.removeEventListener("scroll", calculatePosition);
      };
    }
  }, [isVisible, calculatePosition]);

  const handleMouseEnter = () => {
    if (trigger === "hover") {
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (trigger === "hover") {
      setIsVisible(false);
    }
  };

  const handleClick = () => {
    if (trigger === "click") {
      setIsVisible(!isVisible);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        trigger === "click" &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [trigger]);

  return (
    <>
      <div
        ref={triggerRef}
        className={`inline-flex ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {children || (
          <div className="info-tooltip-trigger">
            ?
          </div>
        )}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          className="tooltip show fixed z-50 px-3 py-2 text-sm rounded-lg shadow-lg"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            backgroundColor: 'var(--theme-textPrimary)',
            color: 'var(--theme-background)',
            maxWidth: '300px',
            zIndex: 9999,
          }}
          role="tooltip"
          aria-live="polite"
        >
          {content}
          
          {/* Tooltip arrow */}
          <div
            className="absolute w-2 h-2 transform rotate-45"
            style={{
              backgroundColor: 'var(--theme-textPrimary)',
              ...(position === "top" && {
                bottom: '-4px',
                left: '50%',
                marginLeft: '-4px',
              }),
              ...(position === "bottom" && {
                top: '-4px',
                left: '50%',
                marginLeft: '-4px',
              }),
              ...(position === "left" && {
                right: '-4px',
                top: '50%',
                marginTop: '-4px',
              }),
              ...(position === "right" && {
                left: '-4px',
                top: '50%',
                marginTop: '-4px',
              }),
            }}
          />
        </div>
      )}
    </>
  );
};

// Preset info tooltips for common use cases
export const APYTooltip: FC = () => (
  <InfoTooltip
    content={
      <div>
        <div className="font-semibold mb-1">Annual Percentage Yield (APY)</div>
        <div>The effective annual rate of return on your deposit, including compound interest.</div>
      </div>
    }
  />
);

export const UtilizationTooltip: FC = () => (
  <InfoTooltip
    content={
      <div>
        <div className="font-semibold mb-1">Utilization Rate</div>
        <div>The percentage of available liquidity currently being borrowed. Higher utilization typically means higher interest rates.</div>
      </div>
    }
  />
);

export const HealthFactorTooltip: FC = () => (
  <InfoTooltip
    content={
      <div>
        <div className="font-semibold mb-1">Health Factor</div>
        <div>A numeric representation of the safety of your deposited assets. Values below 1.0 may result in liquidation.</div>
      </div>
    }
  />
);

export const CollateralTooltip: FC = () => (
  <InfoTooltip
    content={
      <div>
        <div className="font-semibold mb-1">Collateral</div>
        <div>Assets deposited as security for borrowing. Can be liquidated if health factor drops below 1.0.</div>
      </div>
    }
  />
);