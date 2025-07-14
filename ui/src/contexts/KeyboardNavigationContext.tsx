"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';

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

export interface FocusableElement {
  id: string;
  element: HTMLElement;
  type: 'button' | 'input' | 'link' | 'custom';
  description?: string;
  businessFunction?: string;
  tabIndex?: number;
}

export interface KeyboardNavigationState {
  shortcuts: KeyboardShortcut[];
  isHelpVisible: boolean;
  focusedElement: string | null;
  navigationMode: boolean;
  focusableElements: FocusableElement[];
  currentFocusIndex: number;
  showContextualTooltip: boolean;
  contextualTooltipData: {
    description: string;
    businessFunction: string;
    position: { x: number; y: number };
  } | null;
}

interface KeyboardNavigationContextType {
  state: KeyboardNavigationState;
  registerShortcut: (shortcut: KeyboardShortcut) => () => void;
  unregisterShortcut: (shortcut: KeyboardShortcut) => void;
  toggleHelp: () => void;
  setFocusedElement: (element: string | null) => void;
  toggleNavigationMode: () => void;
  executeShortcut: (key: string, modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean }) => boolean;
  registerFocusableElement: (element: FocusableElement) => () => void;
  unregisterFocusableElement: (id: string) => void;
  navigateNext: () => void;
  navigatePrevious: () => void;
  activateCurrentElement: () => void;
  showContextualHelp: () => void;
  hideContextualHelp: () => void;
  updateFocusableElements: () => void;
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
    focusableElements: [],
    currentFocusIndex: -1,
    showContextualTooltip: false,
    contextualTooltipData: null,
  });

  const navigationModeRef = useRef(false);
  const focusableElementsRef = useRef<FocusableElement[]>([]);

  // Update refs when state changes
  useEffect(() => {
    navigationModeRef.current = state.navigationMode;
    focusableElementsRef.current = state.focusableElements;
  }, [state.navigationMode, state.focusableElements]);

  const updateFocusableElements = useCallback(() => {
    // Find all focusable elements in the document
    const selectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"]):not([disabled])',
      '[role="button"]:not([disabled])',
      '[role="link"]:not([disabled])',
    ];

    const elements = document.querySelectorAll(selectors.join(', ')) as NodeListOf<HTMLElement>;
    const newFocusableElements: FocusableElement[] = [];

    elements.forEach((element, index) => {
      if (element.offsetParent !== null) { // Only visible elements
        const type = element.tagName.toLowerCase() === 'button' ? 'button' :
                    ['input', 'textarea', 'select'].includes(element.tagName.toLowerCase()) ? 'input' :
                    element.tagName.toLowerCase() === 'a' ? 'link' : 'custom';

        const id = element.id || `focusable-${index}`;
        const description = element.getAttribute('aria-label') || 
                          element.getAttribute('title') || 
                          element.textContent?.trim() || 
                          'Interactive element';

        const businessFunction = element.getAttribute('data-business-function') ||
                                element.getAttribute('aria-describedby') ||
                                'Interactive element with keyboard support';

        newFocusableElements.push({
          id,
          element,
          type,
          description,
          businessFunction,
          tabIndex: element.tabIndex,
        });
      }
    });

    setState(prev => ({
      ...prev,
      focusableElements: newFocusableElements,
      currentFocusIndex: prev.currentFocusIndex >= newFocusableElements.length ? -1 : prev.currentFocusIndex,
    }));
  }, []);

  const registerFocusableElement = useCallback((element: FocusableElement) => {
    setState(prev => ({
      ...prev,
      focusableElements: [...prev.focusableElements, element],
    }));

    return () => {
      setState(prev => ({
        ...prev,
        focusableElements: prev.focusableElements.filter(el => el.id !== element.id),
      }));
    };
  }, []);

  const unregisterFocusableElement = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      focusableElements: prev.focusableElements.filter(el => el.id !== id),
    }));
  }, []);

  const navigateNext = useCallback(() => {
    setState(prev => {
      if (prev.focusableElements.length === 0) return prev;
      
      // Clear outline from current element before moving
      if (prev.currentFocusIndex >= 0 && prev.focusableElements[prev.currentFocusIndex]) {
        const currentElement = prev.focusableElements[prev.currentFocusIndex];
        currentElement.element.style.outline = '';
        currentElement.element.style.outlineOffset = '';
      }
      
      const nextIndex = (prev.currentFocusIndex + 1) % prev.focusableElements.length;
      const nextElement = prev.focusableElements[nextIndex];
      
      if (nextElement) {
        nextElement.element.focus();
        nextElement.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add visual focus indicator
        nextElement.element.style.outline = '2px solid var(--theme-primary)';
        nextElement.element.style.outlineOffset = '2px';
      }
      
      return {
        ...prev,
        currentFocusIndex: nextIndex,
        focusedElement: nextElement?.id || null,
        showContextualTooltip: false,
      };
    });
  }, []);

  const navigatePrevious = useCallback(() => {
    setState(prev => {
      if (prev.focusableElements.length === 0) return prev;
      
      // Clear outline from current element before moving
      if (prev.currentFocusIndex >= 0 && prev.focusableElements[prev.currentFocusIndex]) {
        const currentElement = prev.focusableElements[prev.currentFocusIndex];
        currentElement.element.style.outline = '';
        currentElement.element.style.outlineOffset = '';
      }
      
      const prevIndex = prev.currentFocusIndex <= 0 
        ? prev.focusableElements.length - 1 
        : prev.currentFocusIndex - 1;
      const prevElement = prev.focusableElements[prevIndex];
      
      if (prevElement) {
        prevElement.element.focus();
        prevElement.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add visual focus indicator
        prevElement.element.style.outline = '2px solid var(--theme-primary)';
        prevElement.element.style.outlineOffset = '2px';
      }
      
      return {
        ...prev,
        currentFocusIndex: prevIndex,
        focusedElement: prevElement?.id || null,
        showContextualTooltip: false,
      };
    });
  }, []);

  const activateCurrentElement = useCallback(() => {
    const currentElement = state.focusableElements[state.currentFocusIndex];
    if (!currentElement) return;

    const element = currentElement.element;
    
    // Handle different element types
    if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
      // For text inputs, move to next element instead of activating
      navigateNext();
    } else {
      // For buttons, links, and other interactive elements, trigger click
      element.click();
    }
  }, [state.focusableElements, state.currentFocusIndex, navigateNext]);

  const showContextualHelp = useCallback(() => {
    const currentElement = state.focusableElements[state.currentFocusIndex];
    if (!currentElement) return;

    const rect = currentElement.element.getBoundingClientRect();
    
    setState(prev => ({
      ...prev,
      showContextualTooltip: true,
      contextualTooltipData: {
        description: currentElement.description || 'Interactive element',
        businessFunction: currentElement.businessFunction || 'Provides functionality for the application',
        position: {
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        },
      },
    }));
  }, [state.focusableElements, state.currentFocusIndex]);

  const hideContextualHelp = useCallback(() => {
    setState(prev => ({
      ...prev,
      showContextualTooltip: false,
      contextualTooltipData: null,
    }));
  }, []);

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
    setState(prev => {
      const newNavigationMode = !prev.navigationMode;
      
      if (newNavigationMode) {
        // Entering navigation mode - scan for focusable elements
        updateFocusableElements();
      } else {
        // Exiting navigation mode - clear focus indicators
        prev.focusableElements.forEach(element => {
          element.element.style.outline = '';
          element.element.style.outlineOffset = '';
        });
      }
      
      return {
        ...prev,
        navigationMode: newNavigationMode,
        currentFocusIndex: newNavigationMode ? 0 : -1,
        showContextualTooltip: false,
      };
    });
  }, [updateFocusableElements]);

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

  // Enhanced global keyboard event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';

      // Handle navigation mode first
      if (navigationModeRef.current) {
        switch (event.key) {
          case 'ArrowDown':
          case 'ArrowRight':
            event.preventDefault();
            navigateNext();
            return;
          
          case 'ArrowUp':
          case 'ArrowLeft':
            event.preventDefault();
            navigatePrevious();
            return;
          
          case 'Enter':
            if (event.ctrlKey) {
              event.preventDefault();
              activateCurrentElement();
              return;
            } else if (!isInInputField) {
              event.preventDefault();
              activateCurrentElement();
              return;
            }
            // In input fields, let Enter work normally for new lines
            break;
          
          case '`':
            event.preventDefault();
            hideContextualHelp();
            toggleNavigationMode();
            return;
        }
      }

      // Handle contextual help - works from anywhere, any mode
      if (event.key === '.' && !isInInputField) {
        event.preventDefault();
        if (navigationModeRef.current) {
          showContextualHelp();
        }
        return;
      }

      // Handle global shortcuts
      if (event.key === '`' && !navigationModeRef.current) {
        // Backtick from main root page opens navigation menu
        const pathname = window.location.pathname;
        if (pathname === '/') {
          event.preventDefault();
          toggleNavigationMode();
          return;
        }
      }

      if (event.key === 'Escape') {
        if (state.isHelpVisible) {
          toggleHelp();
          return;
        }
      }

      // Handle Ctrl+Enter in input fields when not in navigation mode
      if (event.key === 'Enter' && event.ctrlKey && isInInputField && !navigationModeRef.current) {
        event.preventDefault();
        // Focus next focusable element
        const currentElement = target;
        const allFocusable = document.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"]):not([disabled])'
        ) as NodeListOf<HTMLElement>;
        
        const currentIndex = Array.from(allFocusable).indexOf(currentElement);
        if (currentIndex >= 0 && currentIndex < allFocusable.length - 1) {
          allFocusable[currentIndex + 1].focus();
        }
        return;
      }

      // Regular shortcuts only when not typing in input fields
      if (isInInputField && !(event.metaKey || event.ctrlKey)) {
        return;
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
  }, [executeShortcut, navigateNext, navigatePrevious, activateCurrentElement, showContextualHelp, hideContextualHelp, toggleNavigationMode, toggleHelp, state.isHelpVisible]);

  // Update focusable elements when DOM changes
  useEffect(() => {
    if (navigationModeRef.current) {
      const observer = new MutationObserver(() => {
        updateFocusableElements();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled', 'tabindex', 'hidden'],
      });

      return () => observer.disconnect();
    }
  }, [updateFocusableElements]);

  // Clean up focus indicators when component unmounts
  useEffect(() => {
    return () => {
      focusableElementsRef.current.forEach(element => {
        if (element.element) {
          element.element.style.outline = '';
          element.element.style.outlineOffset = '';
        }
      });
    };
  }, []);

  // Register default shortcuts
  useEffect(() => {
    const defaultShortcuts: KeyboardShortcut[] = [
      {
        key: 'k',
        metaKey: true,
        description: 'Open keyboard shortcuts help (Mac)',
        action: toggleHelp,
        category: 'Global',
        element: 'help-toggle-mac',
      },
      {
        key: '/',
        ctrlKey: true,
        description: 'Open keyboard shortcuts help (Windows/Linux)',
        action: toggleHelp,
        category: 'Global',
        element: 'help-toggle-ctrl',
      },
      {
        key: 'F1',
        description: 'Show keyboard shortcuts help',
        action: toggleHelp,
        category: 'Global',
        element: 'help-toggle-f1',
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
    registerFocusableElement,
    unregisterFocusableElement,
    navigateNext,
    navigatePrevious,
    activateCurrentElement,
    showContextualHelp,
    hideContextualHelp,
    updateFocusableElements,
  };

  return (
    <KeyboardNavigationContext.Provider value={contextValue}>
      {children}
    </KeyboardNavigationContext.Provider>
  );
};