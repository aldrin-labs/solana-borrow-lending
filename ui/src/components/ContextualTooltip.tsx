"use client";

import React from 'react';
import { useKeyboardNavigation } from '@/contexts/KeyboardNavigationContext';

export const ContextualTooltip: React.FC = () => {
  const { state } = useKeyboardNavigation();

  if (!state.showContextualTooltip || !state.contextualTooltipData) {
    return null;
  }

  const { description, businessFunction, position } = state.contextualTooltipData;

  return (
    <div
      className="fixed z-50 max-w-sm p-4 rounded-lg shadow-lg border pointer-events-none"
      style={{
        left: position.x - 150, // Center the tooltip
        top: position.y - 120, // Position above the element
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
            Element Description
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
            Business Function
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
          bottom: '-6px',
          left: '50%',
          marginLeft: '-6px',
          backgroundColor: 'var(--theme-surface)',
          borderRight: '1px solid var(--theme-border)',
          borderBottom: '1px solid var(--theme-border)',
        }}
      />
    </div>
  );
};