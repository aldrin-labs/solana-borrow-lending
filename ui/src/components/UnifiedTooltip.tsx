/**
 * Unified Tooltip Component
 * Consolidates Tooltip and InfoTooltip functionality into a single, feature-rich component
 */

"use client";

import React, { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { ANIMATION } from '../utils/constants';

export interface TooltipProps {
  // Content and display
  content: ReactNode;
  children?: ReactNode;
  
  // Positioning
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  offset?: number;
  
  // Interaction
  trigger?: 'hover' | 'click' | 'focus' | 'manual';
  delay?: number;
  
  // Styling
  className?: string;
  variant?: 'default' | 'info' | 'warning' | 'error' | 'success';
  size?: 'sm' | 'md' | 'lg';
  
  // Behavior
  disabled?: boolean;
  keepOpenOnHover?: boolean;
  closeOnClickOutside?: boolean;
  
  // Accessibility
  ariaLabel?: string;
  role?: string;
  
  // Callbacks
  onOpen?: () => void;
  onClose?: () => void;
  
  // Manual control
  open?: boolean;
  defaultOpen?: boolean;
}

// Preset tooltip components for common use cases
export const InfoTooltip: React.FC<Omit<TooltipProps, 'children' | 'variant'>> = (props) => (
  <Tooltip {...props} variant="info">
    <div className="info-tooltip-trigger">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9,9h0a3,3,0,0,1,6,0c0,2-3,3-3,3"/>
        <path d="M12,17h0"/>
      </svg>
    </div>
  </Tooltip>
);

export const APYTooltip: React.FC<Omit<TooltipProps, 'content' | 'children'>> = (props) => (
  <InfoTooltip
    {...props}
    content={
      <div>
        <div className="font-semibold mb-1">Annual Percentage Yield (APY)</div>
        <div>The effective annual rate of return on your deposit, including compound interest.</div>
      </div>
    }
  />
);

export const UtilizationTooltip: React.FC<Omit<TooltipProps, 'content' | 'children'>> = (props) => (
  <InfoTooltip
    {...props}
    content={
      <div>
        <div className="font-semibold mb-1">Utilization Rate</div>
        <div>The percentage of available liquidity currently being borrowed. Higher utilization typically means higher interest rates.</div>
      </div>
    }
  />
);

export const HealthFactorTooltip: React.FC<Omit<TooltipProps, 'content' | 'children'>> = (props) => (
  <InfoTooltip
    {...props}
    content={
      <div>
        <div className="font-semibold mb-1">Health Factor</div>
        <div>A numeric representation of the safety of your deposited assets. Values below 1.0 may result in liquidation.</div>
      </div>
    }
  />
);

export const CollateralTooltip: React.FC<Omit<TooltipProps, 'content' | 'children'>> = (props) => (
  <InfoTooltip
    {...props}
    content={
      <div>
        <div className="font-semibold mb-1">Collateral</div>
        <div>Assets deposited as security for borrowing. Can be liquidated if health factor drops below 1.0.</div>
      </div>
    }
  />
);

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  offset = 8,
  trigger = 'hover',
  delay = ANIMATION.TOOLTIP_DELAY_MS,
  className = '',
  variant = 'default',
  size = 'md',
  disabled = false,
  keepOpenOnHover = false,
  closeOnClickOutside = true,
  ariaLabel,
  role = 'tooltip',
  onOpen,
  onClose,
  open,
  defaultOpen = false,
}) => {
  const [isVisible, setIsVisible] = useState(defaultOpen);
  const [actualPosition, setActualPosition] = useState(position);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const lastCalculateRef = useRef<number>(0);
  const lastShowRef = useRef<number>(0);
  const lastHideRef = useRef<number>(0);

  // Use controlled state if provided
  const isControlled = open !== undefined;
  const visible = isControlled ? open : isVisible;

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    // Debounce position calculations to prevent rapid recalculations
    const debounceMs = 16; // ~60fps
    if (lastCalculateRef.current && Date.now() - lastCalculateRef.current < debounceMs) {
      return;
    }
    lastCalculateRef.current = Date.now();

    try {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      // Check if trigger is still in DOM and visible
      if (!triggerRef.current.isConnected || triggerRect.width === 0 || triggerRect.height === 0) {
        return;
      }

      let bestPosition = position;
      let x = 0;
      let y = 0;

      // Calculate position based on preference
      const calculateCoords = (pos: typeof position) => {
        switch (pos) {
          case 'top':
            return {
              x: triggerRect.left + triggerRect.width / 2,
              y: triggerRect.top - offset,
            };
          case 'bottom':
            return {
              x: triggerRect.left + triggerRect.width / 2,
              y: triggerRect.bottom + offset,
            };
          case 'left':
            return {
              x: triggerRect.left - offset,
              y: triggerRect.top + triggerRect.height / 2,
            };
          case 'right':
            return {
              x: triggerRect.right + offset,
              y: triggerRect.top + triggerRect.height / 2,
            };
          default:
            return { x: 0, y: 0 };
        }
      };

      // Auto-position if needed
      if (position === 'auto') {
        const positions = ['top', 'bottom', 'left', 'right'] as const;
        let bestFit: typeof positions[number] = positions[0];
        let bestScore = -1;

        for (const pos of positions) {
          const coords = calculateCoords(pos);
          let score = 0;

          // Check if tooltip fits in viewport
          if (coords.x - tooltipRect.width / 2 >= 0 && coords.x + tooltipRect.width / 2 <= viewport.width) {
            score += 2;
          }
          if (coords.y - tooltipRect.height >= 0 && coords.y + tooltipRect.height <= viewport.height) {
            score += 2;
          }

          // Prefer top/bottom over left/right
          if (pos === 'top' || pos === 'bottom') {
            score += 1;
          }

          if (score > bestScore) {
            bestScore = score;
            bestFit = pos;
          }
        }

        bestPosition = bestFit;
      } else {
        bestPosition = position;
      }

      const finalCoords = calculateCoords(bestPosition);
      x = finalCoords.x;
      y = finalCoords.y;

      // Adjust for viewport boundaries
      if (bestPosition === 'top' || bestPosition === 'bottom') {
        // Center horizontally, adjust if needed
        x = Math.max(tooltipRect.width / 2, Math.min(x, viewport.width - tooltipRect.width / 2));
      } else {
        // Center vertically, adjust if needed
        y = Math.max(tooltipRect.height / 2, Math.min(y, viewport.height - tooltipRect.height / 2));
      }

      // Ensure coordinates are valid
      if (isNaN(x) || isNaN(y)) {
        return;
      }

      // Only update if position significantly changed (prevent micro-movements)
      const threshold = 1;
      if (Math.abs(coords.x - x) > threshold || Math.abs(coords.y - y) > threshold) {
        setCoords({ x, y });
        setActualPosition(bestPosition);
      }
    } catch (error) {
      console.warn('Tooltip: error calculating position:', error);
    }
  }, [position, offset, coords.x, coords.y]);

  const showTooltip = useCallback(() => {
    if (disabled || isControlled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Prevent rapid show/hide cycles
    if (lastShowRef.current && Date.now() - lastShowRef.current < 100) {
      return;
    }
    lastShowRef.current = Date.now();

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      onOpen?.();
    }, delay);
  }, [disabled, isControlled, delay, onOpen]);

  const hideTooltip = useCallback(() => {
    if (disabled || isControlled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Prevent rapid show/hide cycles
    if (lastHideRef.current && Date.now() - lastHideRef.current < 100) {
      return;
    }
    lastHideRef.current = Date.now();

    setIsVisible(false);
    onClose?.();
  }, [disabled, isControlled, onClose]);

  const handleMouseEnter = useCallback(() => {
    if (trigger === 'hover') {
      showTooltip();
    }
  }, [trigger, showTooltip]);

  const handleMouseLeave = useCallback(() => {
    if (trigger === 'hover' && !keepOpenOnHover) {
      hideTooltip();
    }
  }, [trigger, keepOpenOnHover, hideTooltip]);

  const handleFocus = useCallback(() => {
    if (trigger === 'focus') {
      showTooltip();
    }
  }, [trigger, showTooltip]);

  const handleBlur = useCallback(() => {
    if (trigger === 'focus') {
      hideTooltip();
    }
  }, [trigger, hideTooltip]);

  const handleClick = useCallback(() => {
    if (trigger === 'click') {
      if (visible) {
        hideTooltip();
      } else {
        showTooltip();
      }
    }
  }, [trigger, visible, showTooltip, hideTooltip]);

  // Handle click outside
  useEffect(() => {
    if (!closeOnClickOutside || !visible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node)
      ) {
        hideTooltip();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeOnClickOutside, visible, hideTooltip]);

  // Update position when visible
  useEffect(() => {
    if (visible) {
      calculatePosition();
      
      // Throttle resize and scroll events to prevent excessive recalculations
      let resizeTimeout: NodeJS.Timeout;
      let scrollTimeout: NodeJS.Timeout;
      
      const handleResize = () => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(calculatePosition, 100);
      };
      
      const handleScroll = () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(calculatePosition, 50);
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
        if (resizeTimeout) clearTimeout(resizeTimeout);
        if (scrollTimeout) clearTimeout(scrollTimeout);
      };
    }
  }, [visible, calculatePosition]);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Get styling classes
  const getTooltipClasses = () => {
    const baseClasses = 'fixed z-[9999] px-3 py-2 text-sm rounded-lg shadow-lg pointer-events-none';
    
    const sizeClasses = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-2 text-sm',
      lg: 'px-4 py-3 text-base',
    };

    const variantClasses = {
      default: 'bg-gray-900 text-white',
      info: 'bg-blue-600 text-white',
      warning: 'bg-yellow-600 text-white',
      error: 'bg-red-600 text-white',
      success: 'bg-green-600 text-white',
    };

    const transitionClasses = visible 
      ? 'opacity-100 scale-100 transition-all duration-300 ease-out'
      : 'opacity-0 scale-95 transition-all duration-300 ease-in';

    return `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${transitionClasses} ${className}`;
  };

  const getArrowClasses = () => {
    const baseClasses = 'absolute w-2 h-2 transform rotate-45';
    
    const variantClasses = {
      default: 'bg-gray-900',
      info: 'bg-blue-600',
      warning: 'bg-yellow-600',
      error: 'bg-red-600',
      success: 'bg-green-600',
    };

    const positionClasses = {
      top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
      bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
      left: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2',
      right: 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2',
    };

    const validPosition = actualPosition === 'auto' ? 'top' : actualPosition;
    return `${baseClasses} ${variantClasses[variant]} ${positionClasses[validPosition]}`;
  };

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-flex"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
        aria-describedby={visible ? 'tooltip' : undefined}
        aria-label={ariaLabel}
      >
        {children}
      </div>

      {visible && (
        <div
          ref={tooltipRef}
          id="tooltip"
          className={getTooltipClasses()}
          style={{
            left: coords.x,
            top: coords.y,
            transform: actualPosition === 'top' || actualPosition === 'bottom' 
              ? 'translateX(-50%)' 
              : actualPosition === 'left' || actualPosition === 'right' 
              ? 'translateY(-50%)' 
              : undefined,
            maxWidth: '320px',
            zIndex: 9999,
          }}
          role={role}
          aria-live="polite"
          onMouseEnter={keepOpenOnHover ? () => showTooltip() : undefined}
          onMouseLeave={keepOpenOnHover ? () => hideTooltip() : undefined}
        >
          {content}
          
          {/* Tooltip arrow */}
          <div className={getArrowClasses()} />
        </div>
      )}
    </>
  );
};