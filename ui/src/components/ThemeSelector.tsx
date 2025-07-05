"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useTheme, themes, ThemeType } from '@/contexts/ThemeContext';

export const ThemeSelector: React.FC = () => {
  const { currentTheme, setTheme, themeType } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleThemeChange = (newTheme: ThemeType) => {
    setTheme(newTheme);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-opacity-10"
        style={{
          color: 'var(--theme-textSecondary)',
          backgroundColor: isOpen ? 'var(--theme-surface)' : 'transparent',
        }}
        aria-label="Select theme"
      >
        <div
          className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
          style={{
            background: `var(--theme-gradient-primary)`,
          }}
        />
        <span className="hidden sm:inline">{currentTheme.name}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-64 rounded-lg shadow-xl border z-50 backdrop-blur-lg animate-slide-down"
          style={{
            backgroundColor: 'var(--theme-card)',
            borderColor: 'var(--theme-border)',
            boxShadow: 'var(--theme-shadow-xl)',
          }}
        >
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-3 py-2">
              Choose Theme
            </div>
            <div className="space-y-1">
              {Object.entries(themes).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => handleThemeChange(key as ThemeType)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:bg-opacity-10 ${
                    themeType === key ? 'bg-opacity-10' : ''
                  }`}
                  style={{
                    color: 'var(--theme-textPrimary)',
                    backgroundColor: themeType === key ? 'var(--theme-primary)' : 'transparent',
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                    style={{
                      background: theme.gradients.primary,
                    }}
                  />
                  <div className="flex-1 text-left">
                    <div className="font-medium">{theme.name}</div>
                    <div className="text-xs opacity-60 capitalize">{theme.type}</div>
                  </div>
                  {themeType === key && (
                    <svg
                      className="w-4 h-4 text-current"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          <div className="border-t p-3" style={{ borderColor: 'var(--theme-border)' }}>
            <div className="text-xs opacity-60">
              Your theme preference is automatically saved
            </div>
          </div>
        </div>
      )}
    </div>
  );
};