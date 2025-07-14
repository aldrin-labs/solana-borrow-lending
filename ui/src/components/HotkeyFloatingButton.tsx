"use client";

import React, { useState } from 'react';
import { useKeyboardNavigation } from '@/contexts/KeyboardNavigationContext';

export const HotkeyFloatingButton: React.FC = () => {
  const { toggleHelp } = useKeyboardNavigation();
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={toggleHelp}
        className="group bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 ease-in-out hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        title="Keyboard Shortcuts (Ctrl+/ or F1)"
        aria-label="Open keyboard shortcuts help"
      >
        <div className="flex items-center justify-center w-5 h-5">
          <span className="text-sm font-bold">?</span>
        </div>
        
        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          Shortcuts
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </button>
      
      {/* Dismissal option */}
      <button
        onClick={() => setIsVisible(false)}
        className="absolute -top-1 -right-1 bg-gray-400 hover:bg-gray-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs transition-colors duration-200 opacity-0 hover:opacity-100"
        title="Hide hotkey button"
        aria-label="Hide hotkey button"
      >
        ×
      </button>
    </div>
  );
};