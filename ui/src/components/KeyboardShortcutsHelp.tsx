"use client";

import React, { useEffect, useRef } from 'react';
import { useKeyboardNavigation } from '@/contexts/KeyboardNavigationContext';

export const KeyboardShortcutsHelp: React.FC = () => {
  const { state, toggleHelp } = useKeyboardNavigation();
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus management for accessibility
  useEffect(() => {
    if (state.isHelpVisible && modalRef.current) {
      modalRef.current.focus();
    }
  }, [state.isHelpVisible]);

  // Group shortcuts by category
  const groupedShortcuts = state.shortcuts.reduce((groups, shortcut) => {
    const category = shortcut.category || 'General';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(shortcut);
    return groups;
  }, {} as Record<string, typeof state.shortcuts>);

  const formatShortcut = (shortcut: any) => {
    const parts: string[] = [];
    if (shortcut.metaKey) parts.push('⌘');
    if (shortcut.ctrlKey) parts.push('Ctrl');
    if (shortcut.altKey) parts.push('Alt');
    if (shortcut.shiftKey) parts.push('Shift');
    parts.push(shortcut.key.toUpperCase());
    return parts.join('+');
  };

  if (!state.isHelpVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={toggleHelp}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      />
      
      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
        style={{
          backgroundColor: 'var(--theme-surface)',
          border: '1px solid var(--theme-border)',
          boxShadow: 'var(--theme-shadow-xl)',
        }}
        tabIndex={-1}
        role="dialog"
        aria-labelledby="shortcuts-title"
        aria-modal="true"
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-6 border-b"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div>
            <h2 
              id="shortcuts-title"
              className="text-xl font-semibold"
              style={{ color: 'var(--theme-textPrimary)' }}
            >
              Keyboard Shortcuts
            </h2>
            <p 
              className="text-sm mt-1"
              style={{ color: 'var(--theme-textSecondary)' }}
            >
              Navigate the app efficiently with keyboard shortcuts
            </p>
          </div>
          <button
            onClick={toggleHelp}
            className="p-2 rounded-lg hover:bg-opacity-80 transition-colors"
            style={{ 
              backgroundColor: 'var(--theme-border)',
              color: 'var(--theme-textSecondary)'
            }}
            aria-label="Close keyboard shortcuts help"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-96">
          {/* Navigation System Documentation */}
          <div className="mb-6">
            <h3 
              className="text-lg font-medium mb-3"
              style={{ color: 'var(--theme-textPrimary)' }}
            >
              Navigation System
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span 
                  className="text-sm"
                  style={{ color: 'var(--theme-textSecondary)' }}
                >
                  Enter navigation mode (from homepage)
                </span>
                <kbd 
                  className="px-2 py-1 text-xs font-mono rounded border"
                  style={{
                    backgroundColor: 'var(--theme-background)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-textPrimary)',
                  }}
                >
                  `
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span 
                  className="text-sm"
                  style={{ color: 'var(--theme-textSecondary)' }}
                >
                  Navigate between elements (in navigation mode)
                </span>
                <kbd 
                  className="px-2 py-1 text-xs font-mono rounded border"
                  style={{
                    backgroundColor: 'var(--theme-background)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-textPrimary)',
                  }}
                >
                  ↑↓←→
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span 
                  className="text-sm"
                  style={{ color: 'var(--theme-textSecondary)' }}
                >
                  Show contextual help for selected element
                </span>
                <kbd 
                  className="px-2 py-1 text-xs font-mono rounded border"
                  style={{
                    backgroundColor: 'var(--theme-background)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-textPrimary)',
                  }}
                >
                  .
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span 
                  className="text-sm"
                  style={{ color: 'var(--theme-textSecondary)' }}
                >
                  Activate selected element
                </span>
                <kbd 
                  className="px-2 py-1 text-xs font-mono rounded border"
                  style={{
                    backgroundColor: 'var(--theme-background)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-textPrimary)',
                  }}
                >
                  Enter / Ctrl+Enter
                </kbd>
              </div>
            </div>
          </div>

          {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 
                className="text-lg font-medium mb-3"
                style={{ color: 'var(--theme-textPrimary)' }}
              >
                {category}
              </h3>
              <div className="space-y-2">
                {shortcuts.map((shortcut, index) => (
                  <div key={`${category}-${index}`} className="flex items-center justify-between">
                    <span 
                      className="text-sm"
                      style={{ color: 'var(--theme-textSecondary)' }}
                    >
                      {shortcut.description}
                    </span>
                    <kbd 
                      className="px-2 py-1 text-xs font-mono rounded border"
                      style={{
                        backgroundColor: 'var(--theme-background)',
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-textPrimary)',
                      }}
                    >
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {Object.keys(groupedShortcuts).length === 0 && (
            <div 
              className="text-center py-8"
              style={{ color: 'var(--theme-textMuted)' }}
            >
              <div className="mb-2">
                <svg className="w-12 h-12 mx-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <p className="text-sm">No keyboard shortcuts registered yet.</p>
              <p className="text-xs mt-1">Shortcuts will appear here as you explore the app.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="flex items-center justify-between p-4 border-t text-sm"
          style={{ 
            borderColor: 'var(--theme-border)',
            backgroundColor: 'var(--theme-background)',
            color: 'var(--theme-textMuted)'
          }}
        >
          <span>💡 Tip: Hover over buttons and controls to see their shortcuts</span>
          <span>Press <kbd className="px-1 py-0.5 text-xs font-mono bg-black bg-opacity-10 rounded">ESC</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};