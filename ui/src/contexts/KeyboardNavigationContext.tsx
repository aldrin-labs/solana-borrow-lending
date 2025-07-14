"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  description: string;
  action: () => void;
  category?: string;
  element?: string;
}

export interface KeyboardNavigationState {
  shortcuts: KeyboardShortcut[];
  isHelpVisible: boolean;
  focusedElement: string | null;
  navigationMode: boolean;
}

interface KeyboardNavigationContextType {
  state: KeyboardNavigationState;
  registerShortcut: (shortcut: KeyboardShortcut) => () => void;
  unregisterShortcut: (shortcut: KeyboardShortcut) => void;
  toggleHelp: () => void;
  setFocusedElement: (element: string | null) => void;
  toggleNavigationMode: () => void;
  executeShortcut: (key: string, modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean }) => boolean;
}

const KeyboardNavigationContext = createContext<KeyboardNavigationContextType | undefined>(undefined);

export const useKeyboardNavigation = () => {
  const context = useContext(KeyboardNavigationContext);
  if (!context) {
    throw new Error('useKeyboardNavigation must be used within a KeyboardNavigationProvider');
  }
  return context;
};

export const KeyboardNavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<KeyboardNavigationState>({
    shortcuts: [],
    isHelpVisible: false,
    focusedElement: null,
    navigationMode: false,
  });

  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setState(prev => ({
      ...prev,
      shortcuts: [...prev.shortcuts, shortcut],
    }));

    // Return unregister function
    return () => {
      setState(prev => ({
        ...prev,
        shortcuts: prev.shortcuts.filter(s => s !== shortcut),
      }));
    };
  }, []);

  const unregisterShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setState(prev => ({
      ...prev,
      shortcuts: prev.shortcuts.filter(s => s !== shortcut),
    }));
  }, []);

  const toggleHelp = useCallback(() => {
    setState(prev => ({
      ...prev,
      isHelpVisible: !prev.isHelpVisible,
    }));
  }, []);

  const setFocusedElement = useCallback((element: string | null) => {
    setState(prev => ({
      ...prev,
      focusedElement: element,
    }));
  }, []);

  const toggleNavigationMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      navigationMode: !prev.navigationMode,
    }));
  }, []);

  const executeShortcut = useCallback((
    key: string, 
    modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean }
  ): boolean => {
    const matchingShortcut = state.shortcuts.find(shortcut => {
      const keyMatch = shortcut.key.toLowerCase() === key.toLowerCase();
      const ctrlMatch = !!shortcut.ctrlKey === !!modifiers.ctrlKey;
      const metaMatch = !!shortcut.metaKey === !!modifiers.metaKey;
      const shiftMatch = !!shortcut.shiftKey === !!modifiers.shiftKey;
      const altMatch = !!shortcut.altKey === !!modifiers.altKey;
      
      return keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch;
    });

    if (matchingShortcut) {
      matchingShortcut.action();
      return true;
    }
    return false;
  }, [state.shortcuts]);

  // Global keyboard event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        // Only allow specific shortcuts in input fields
        if (!(event.metaKey || event.ctrlKey)) {
          return;
        }
      }

      const executed = executeShortcut(event.key, {
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      });

      if (executed) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [executeShortcut]);

  // Register default shortcuts
  useEffect(() => {
    const defaultShortcuts: KeyboardShortcut[] = [
      {
        key: 'k',
        metaKey: true,
        description: 'Open command palette / keyboard shortcuts help',
        action: toggleHelp,
        category: 'Global',
        element: 'help-toggle',
      },
      {
        key: '?',
        description: 'Show keyboard shortcuts help',
        action: toggleHelp,
        category: 'Global',
        element: 'help-toggle-alt',
      },
      {
        key: 'Escape',
        description: 'Close help or exit navigation mode',
        action: () => {
          if (state.isHelpVisible) {
            toggleHelp();
          } else if (state.navigationMode) {
            toggleNavigationMode();
          }
        },
        category: 'Global',
        element: 'escape',
      },
    ];

    const unregisterFunctions = defaultShortcuts.map(registerShortcut);
    
    return () => {
      unregisterFunctions.forEach(fn => fn());
    };
  }, [registerShortcut, toggleHelp, toggleNavigationMode, state.isHelpVisible, state.navigationMode]);

  const contextValue: KeyboardNavigationContextType = {
    state,
    registerShortcut,
    unregisterShortcut,
    toggleHelp,
    setFocusedElement,
    toggleNavigationMode,
    executeShortcut,
  };

  return (
    <KeyboardNavigationContext.Provider value={contextValue}>
      {children}
    </KeyboardNavigationContext.Provider>
  );
};