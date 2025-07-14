"use client";

import React from 'react';
import { useKeyboardNavigation } from '@/contexts/KeyboardNavigationContext';

export const NavigationModeIndicator: React.FC = () => {
  const { state, toggleNavigationMode } = useKeyboardNavigation();

  if (!state.navigationMode) {
    return null;
  }

  const currentElement = state.focusableElements[state.currentFocusIndex];

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-40">
      <div
        className="flex items-center gap-3 px-4 py-2 rounded-lg shadow-lg border backdrop-blur-sm"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--theme-surface) 90%, transparent)',
          borderColor: 'var(--theme-primary)',
          boxShadow: '0 4px 12px color-mix(in srgb, var(--theme-primary) 20%, transparent)',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--theme-primary)' }}
          />
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--theme-primary)' }}
          >
            Navigation Mode
          </span>
        </div>

        {currentElement && (
          <div className="flex items-center gap-2">
            <div
              className="w-px h-4"
              style={{ backgroundColor: 'var(--theme-border)' }}
            />
            <span
              className="text-sm"
              style={{ color: 'var(--theme-textSecondary)' }}
            >
              {state.currentFocusIndex + 1} of {state.focusableElements.length}
            </span>
            <span
              className="text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: 'var(--theme-background)',
                color: 'var(--theme-textMuted)',
              }}
            >
              {currentElement.type}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1">
          <div
            className="w-px h-4"
            style={{ backgroundColor: 'var(--theme-border)' }}
          />
          <div className="flex gap-1">
            {['↑', '↓', '→', '←'].map((arrow) => (
              <kbd
                key={arrow}
                className="w-6 h-6 flex items-center justify-center text-xs font-mono rounded border"
                style={{
                  backgroundColor: 'var(--theme-background)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-textSecondary)',
                }}
              >
                {arrow}
              </kbd>
            ))}
          </div>
          <span
            className="text-xs ml-1"
            style={{ color: 'var(--theme-textMuted)' }}
          >
            navigate
          </span>
        </div>

        <div className="flex items-center gap-1">
          <kbd
            className="px-1 py-0.5 text-xs font-mono rounded border"
            style={{
              backgroundColor: 'var(--theme-background)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-textSecondary)',
            }}
          >
            Q
          </kbd>
          <span
            className="text-xs"
            style={{ color: 'var(--theme-textMuted)' }}
          >
            help
          </span>
        </div>

        <button
          onClick={toggleNavigationMode}
          className="ml-2 p-1 rounded hover:bg-opacity-80 transition-colors"
          style={{
            backgroundColor: 'var(--theme-border)',
            color: 'var(--theme-textSecondary)',
          }}
          aria-label="Exit navigation mode"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};