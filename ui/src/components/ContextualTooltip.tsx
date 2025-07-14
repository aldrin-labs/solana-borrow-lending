"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useKeyboardNavigation } from '@/contexts/KeyboardNavigationContext';

export const ContextualTooltip: React.FC = () => {
  const { state } = useKeyboardNavigation();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!state.showContextualTooltip || !state.contextualTooltipData || !tooltipRef.current) {
      return;
    }

    const tooltip = tooltipRef.current;
    const { position } = state.contextualTooltipData;
    const rect = tooltip.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    let x = position.x;
    let y = position.y - 120; // Default: position above element

    // Prevent clipping at viewport edges
    const tooltipWidth = rect.width || 300; // fallback width
    const tooltipHeight = rect.height || 150; // fallback height

    // Adjust horizontal position
    if (x - tooltipWidth / 2 < 8) {
      x = tooltipWidth / 2 + 8; // Ensure left edge is visible
    } else if (x + tooltipWidth / 2 > viewport.width - 8) {
      x = viewport.width - tooltipWidth / 2 - 8; // Ensure right edge is visible
    }

    // Adjust vertical position - prevent clipping at top
    if (y < 8) {
      y = position.y + 30; // Position below element instead
    }
    
    // Prevent clipping at bottom
    if (y + tooltipHeight > viewport.height - 8) {
      y = viewport.height - tooltipHeight - 8;
    }

    setAdjustedPosition({ x, y });
  }, [state.showContextualTooltip, state.contextualTooltipData]);

  if (!state.showContextualTooltip || !state.contextualTooltipData) {
    return null;
  }

  const { description, businessFunction } = state.contextualTooltipData;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 max-w-sm p-4 rounded-lg shadow-lg border pointer-events-none"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        backgroundColor: 'var(--theme-surface)',
        borderColor: 'var(--theme-border)',
        boxShadow: 'var(--theme-shadow-lg)',
        transform: 'translateX(-50%)',
      }}
    >
      <div className="space-y-2">
        <div>
          <h4 
            className="font-semibold text-sm"
            style={{ color: 'var(--theme-primary)' }}
          >
            What does this do?
          </h4>
          <p 
            className="text-sm"
            style={{ color: 'var(--theme-textPrimary)' }}
          >
            {description}
          </p>
        </div>
        
        <div>
          <h4 
            className="font-semibold text-sm"
            style={{ color: 'var(--theme-primary)' }}
          >
            Why might I need this?
          </h4>
          <p 
            className="text-sm"
            style={{ color: 'var(--theme-textSecondary)' }}
          >
            {businessFunction}
          </p>
        </div>
        
        <div 
          className="flex items-center gap-2 text-xs pt-2 border-t"
          style={{ 
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-textMuted)'
          }}
        >
          <span>Press</span>
          <kbd 
            className="px-1 py-0.5 font-mono rounded border"
            style={{
              backgroundColor: 'var(--theme-background)',
              borderColor: 'var(--theme-border)',
            }}
          >
            ↑↓→←
          </kbd>
          <span>to navigate or</span>
          <kbd 
            className="px-1 py-0.5 font-mono rounded border"
            style={{
              backgroundColor: 'var(--theme-background)',
              borderColor: 'var(--theme-border)',
            }}
          >
            ESC
          </kbd>
          <span>to close</span>
        </div>
      </div>
      
      {/* Arrow pointing to the element */}
      <div
        className="absolute w-3 h-3 transform rotate-45"
        style={{
          bottom: adjustedPosition.y > state.contextualTooltipData.position.y ? 'auto' : '-6px',
          top: adjustedPosition.y > state.contextualTooltipData.position.y ? '-6px' : 'auto',
          left: '50%',
          marginLeft: '-6px',
          backgroundColor: 'var(--theme-surface)',
          borderRight: '1px solid var(--theme-border)',
          borderBottom: '1px solid var(--theme-border)',
          transform: adjustedPosition.y > state.contextualTooltipData.position.y ? 'rotate(225deg)' : 'rotate(45deg)',
        }}
      />
    </div>
  );
};