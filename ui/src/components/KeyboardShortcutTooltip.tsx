"use client";

import React, { ReactNode, useEffect, useCallback } from 'react';
import { InfoTooltip } from './InfoTooltip';
import { useKeyboardNavigation, KeyboardShortcut } from '@/contexts/KeyboardNavigationContext';

interface KeyboardShortcutTooltipProps {
  children: ReactNode;
  shortcut: Omit<KeyboardShortcut, 'action'>;
  action: () => void;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  showShortcutInTooltip?: boolean;
  element?: string;
}

export const KeyboardShortcutTooltip: React.FC<KeyboardShortcutTooltipProps> = ({
  children,
  shortcut,
  action,
  className = '',
  position = 'top',
  showShortcutInTooltip = true,
  element,
}) => {
  const { registerShortcut, setFocusedElement } = useKeyboardNavigation();

  const formatShortcut = (shortcut: Omit<KeyboardShortcut, 'action'>) => {
    const parts: string[] = [];
    if (shortcut.metaKey) parts.push('⌘');
    if (shortcut.ctrlKey) parts.push('Ctrl');
    if (shortcut.altKey) parts.push('Alt');
    if (shortcut.shiftKey) parts.push('Shift');
    parts.push(shortcut.key.toUpperCase());
    return parts.join('+');
  };

  // Register the shortcut
  useEffect(() => {
    const fullShortcut: KeyboardShortcut = {
      ...shortcut,
      action,
      element,
    };

    const unregister = registerShortcut(fullShortcut);
    return unregister;
  }, [shortcut, action, element, registerShortcut]);

  const handleFocus = useCallback(() => {
    if (element) {
      setFocusedElement(element);
    }
  }, [element, setFocusedElement]);

  const handleBlur = useCallback(() => {
    setFocusedElement(null);
  }, [setFocusedElement]);

  const handleClick = useCallback(() => {
    action();
  }, [action]);

  const tooltipContent = showShortcutInTooltip ? (
    <div>
      <div className="font-semibold mb-1">{shortcut.description}</div>
      <div className="text-xs opacity-75">
        Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-black bg-opacity-20 rounded border">
          {formatShortcut(shortcut)}
        </kbd>
      </div>
    </div>
  ) : (
    shortcut.description
  );

  return (
    <InfoTooltip content={tooltipContent} position={position}>
      <div
        className={`keyboard-shortcut-element ${className}`}
        tabIndex={0}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
        role="button"
        aria-label={`${shortcut.description}. Keyboard shortcut: ${formatShortcut(shortcut)}`}
      >
        {children}
      </div>
    </InfoTooltip>
  );
};

// Hook for easy shortcut registration without tooltip
export const useKeyboardShortcut = (shortcut: KeyboardShortcut) => {
  const { registerShortcut } = useKeyboardNavigation();

  useEffect(() => {
    const unregister = registerShortcut(shortcut);
    return unregister;
  }, [shortcut, registerShortcut]);
};