"use client";

import React, { useState, useRef, useEffect, ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  children, 
  content, 
  position = 'top',
  delay = 300 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const showTooltip = (event: React.MouseEvent) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      const target = event.currentTarget;
      if (!target) {
        console.warn('Tooltip: currentTarget is null');
        return;
      }
      
      const rect = target.getBoundingClientRect();
      if (!rect) {
        console.warn('Tooltip: getBoundingClientRect returned null');
        return;
      }
      
      let x = 0;
      let y = 0;

      switch (position) {
        case 'top':
          x = rect.left + rect.width / 2;
          y = rect.top - 8;
          break;
        case 'bottom':
          x = rect.left + rect.width / 2;
          y = rect.bottom + 8;
          break;
        case 'left':
          x = rect.left - 8;
          y = rect.top + rect.height / 2;
          break;
        case 'right':
          x = rect.right + 8;
          y = rect.top + rect.height / 2;
          break;
      }

      setCoords({ x, y });
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getTooltipClasses = () => {
    const baseClasses = "tooltip";
    const positionClasses = {
      top: "transform -translate-x-1/2 -translate-y-full",
      bottom: "transform -translate-x-1/2",
      left: "transform -translate-y-1/2 -translate-x-full",
      right: "transform -translate-y-1/2"
    };
    
    return `${baseClasses} ${positionClasses[position]} ${isVisible ? 'show' : ''}`;
  };

  return (
    <>
      <div
        ref={elementRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        className="relative inline-block"
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          className={getTooltipClasses()}
          style={{
            left: coords.x,
            top: coords.y,
          }}
        >
          {content}
          <div className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${
            position === 'top' ? 'top-full left-1/2 -translate-x-1/2 -translate-y-1/2' :
            position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 translate-y-1/2' :
            position === 'left' ? 'left-full top-1/2 -translate-y-1/2 -translate-x-1/2' :
            'right-full top-1/2 -translate-y-1/2 translate-x-1/2'
          }`} />
        </div>
      )}
    </>
  );
};