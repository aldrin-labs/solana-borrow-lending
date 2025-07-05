"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeType = 'light' | 'dark' | 'high-contrast' | 'blue' | 'green' | 'purple' | 'red';

export interface Theme {
  name: string;
  type: ThemeType;
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    secondary: string;
    secondaryDark: string;
    secondaryLight: string;
    background: string;
    surface: string;
    card: string;
    border: string;
    borderLight: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
  };
  shadows: {
    card: string;
    lg: string;
    xl: string;
  };
  gradients: {
    primary: string;
    secondary: string;
    success: string;
    error: string;
  };
}

export const themes: Record<ThemeType, Theme> = {
  light: {
    name: 'Light Banking',
    type: 'light',
    colors: {
      primary: '#3182CE',
      primaryDark: '#2B6CB0',
      primaryLight: '#63B3ED',
      secondary: '#4A5568',
      secondaryDark: '#2D3748',
      secondaryLight: '#718096',
      background: '#FFFFFF',
      surface: '#F7FAFC',
      card: '#FFFFFF',
      border: '#E2E8F0',
      borderLight: '#F7FAFC',
      accent: '#3182CE',
      success: '#38A169',
      warning: '#D69E2E',
      error: '#E53E3E',
      textPrimary: '#2D3748',
      textSecondary: '#4A5568',
      textMuted: '#A0AEC0',
    },
    shadows: {
      card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #3182CE 0%, #2B6CB0 100%)',
      secondary: 'linear-gradient(135deg, #4A5568 0%, #2D3748 100%)',
      success: 'linear-gradient(135deg, #38A169 0%, #2F855A 100%)',
      error: 'linear-gradient(135deg, #E53E3E 0%, #C53030 100%)',
    },
  },
  dark: {
    name: 'Dark Professional',
    type: 'dark',
    colors: {
      primary: '#63B3ED',
      primaryDark: '#3182CE',
      primaryLight: '#90CDF4',
      secondary: '#A0AEC0',
      secondaryDark: '#718096',
      secondaryLight: '#CBD5E0',
      background: '#1A202C',
      surface: '#2D3748',
      card: '#2D3748',
      border: '#4A5568',
      borderLight: '#2D3748',
      accent: '#63B3ED',
      success: '#68D391',
      warning: '#F6E05E',
      error: '#FC8181',
      textPrimary: '#F7FAFC',
      textSecondary: '#E2E8F0',
      textMuted: '#A0AEC0',
    },
    shadows: {
      card: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
      xl: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #63B3ED 0%, #3182CE 100%)',
      secondary: 'linear-gradient(135deg, #A0AEC0 0%, #718096 100%)',
      success: 'linear-gradient(135deg, #68D391 0%, #38A169 100%)',
      error: 'linear-gradient(135deg, #FC8181 0%, #E53E3E 100%)',
    },
  },
  'high-contrast': {
    name: 'High Contrast',
    type: 'high-contrast',
    colors: {
      primary: '#000000',
      primaryDark: '#000000',
      primaryLight: '#333333',
      secondary: '#666666',
      secondaryDark: '#333333',
      secondaryLight: '#999999',
      background: '#FFFFFF',
      surface: '#F5F5F5',
      card: '#FFFFFF',
      border: '#000000',
      borderLight: '#CCCCCC',
      accent: '#000000',
      success: '#006600',
      warning: '#CC6600',
      error: '#CC0000',
      textPrimary: '#000000',
      textSecondary: '#333333',
      textMuted: '#666666',
    },
    shadows: {
      card: '0 2px 4px 0 rgba(0, 0, 0, 0.3)',
      lg: '0 4px 8px 0 rgba(0, 0, 0, 0.3)',
      xl: '0 8px 16px 0 rgba(0, 0, 0, 0.3)',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #000000 0%, #333333 100%)',
      secondary: 'linear-gradient(135deg, #666666 0%, #333333 100%)',
      success: 'linear-gradient(135deg, #006600 0%, #004400 100%)',
      error: 'linear-gradient(135deg, #CC0000 0%, #AA0000 100%)',
    },
  },
  blue: {
    name: 'Ocean Blue',
    type: 'blue',
    colors: {
      primary: '#1E40AF',
      primaryDark: '#1E3A8A',
      primaryLight: '#3B82F6',
      secondary: '#475569',
      secondaryDark: '#334155',
      secondaryLight: '#64748B',
      background: '#F8FAFF',
      surface: '#EBF4FF',
      card: '#FFFFFF',
      border: '#DBEAFE',
      borderLight: '#EBF4FF',
      accent: '#2563EB',
      success: '#059669',
      warning: '#D97706',
      error: '#DC2626',
      textPrimary: '#1E293B',
      textSecondary: '#475569',
      textMuted: '#94A3B8',
    },
    shadows: {
      card: '0 1px 3px 0 rgba(30, 64, 175, 0.1), 0 1px 2px 0 rgba(30, 64, 175, 0.06)',
      lg: '0 10px 15px -3px rgba(30, 64, 175, 0.1), 0 4px 6px -2px rgba(30, 64, 175, 0.05)',
      xl: '0 20px 25px -5px rgba(30, 64, 175, 0.1), 0 10px 10px -5px rgba(30, 64, 175, 0.04)',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #1E40AF 0%, #1E3A8A 100%)',
      secondary: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
      success: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      error: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
    },
  },
  green: {
    name: 'Money Green',
    type: 'green',
    colors: {
      primary: '#16A34A',
      primaryDark: '#15803D',
      primaryLight: '#22C55E',
      secondary: '#525252',
      secondaryDark: '#404040',
      secondaryLight: '#737373',
      background: '#F7FEF7',
      surface: '#ECFDF5',
      card: '#FFFFFF',
      border: '#D1FAE5',
      borderLight: '#ECFDF5',
      accent: '#059669',
      success: '#16A34A',
      warning: '#EAB308',
      error: '#DC2626',
      textPrimary: '#1F2937',
      textSecondary: '#4B5563',
      textMuted: '#9CA3AF',
    },
    shadows: {
      card: '0 1px 3px 0 rgba(22, 163, 74, 0.1), 0 1px 2px 0 rgba(22, 163, 74, 0.06)',
      lg: '0 10px 15px -3px rgba(22, 163, 74, 0.1), 0 4px 6px -2px rgba(22, 163, 74, 0.05)',
      xl: '0 20px 25px -5px rgba(22, 163, 74, 0.1), 0 10px 10px -5px rgba(22, 163, 74, 0.04)',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
      secondary: 'linear-gradient(135deg, #525252 0%, #404040 100%)',
      success: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
      error: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
    },
  },
  purple: {
    name: 'Royal Purple',
    type: 'purple',
    colors: {
      primary: '#7C3AED',
      primaryDark: '#6D28D9',
      primaryLight: '#8B5CF6',
      secondary: '#64748B',
      secondaryDark: '#475569',
      secondaryLight: '#94A3B8',
      background: '#FDFAFF',
      surface: '#F3E8FF',
      card: '#FFFFFF',
      border: '#E9D5FF',
      borderLight: '#F3E8FF',
      accent: '#8B5CF6',
      success: '#059669',
      warning: '#D97706',
      error: '#DC2626',
      textPrimary: '#1F2937',
      textSecondary: '#4B5563',
      textMuted: '#9CA3AF',
    },
    shadows: {
      card: '0 1px 3px 0 rgba(124, 58, 237, 0.1), 0 1px 2px 0 rgba(124, 58, 237, 0.06)',
      lg: '0 10px 15px -3px rgba(124, 58, 237, 0.1), 0 4px 6px -2px rgba(124, 58, 237, 0.05)',
      xl: '0 20px 25px -5px rgba(124, 58, 237, 0.1), 0 10px 10px -5px rgba(124, 58, 237, 0.04)',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
      secondary: 'linear-gradient(135deg, #64748B 0%, #475569 100%)',
      success: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      error: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
    },
  },
  red: {
    name: 'Power Red',
    type: 'red',
    colors: {
      primary: '#DC2626',
      primaryDark: '#B91C1C',
      primaryLight: '#EF4444',
      secondary: '#525252',
      secondaryDark: '#404040',
      secondaryLight: '#737373',
      background: '#FFFBFB',
      surface: '#FEF2F2',
      card: '#FFFFFF',
      border: '#FECACA',
      borderLight: '#FEF2F2',
      accent: '#EF4444',
      success: '#059669',
      warning: '#D97706',
      error: '#DC2626',
      textPrimary: '#1F2937',
      textSecondary: '#4B5563',
      textMuted: '#9CA3AF',
    },
    shadows: {
      card: '0 1px 3px 0 rgba(220, 38, 38, 0.1), 0 1px 2px 0 rgba(220, 38, 38, 0.06)',
      lg: '0 10px 15px -3px rgba(220, 38, 38, 0.1), 0 4px 6px -2px rgba(220, 38, 38, 0.05)',
      xl: '0 20px 25px -5px rgba(220, 38, 38, 0.1), 0 10px 10px -5px rgba(220, 38, 38, 0.04)',
    },
    gradients: {
      primary: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
      secondary: 'linear-gradient(135deg, #525252 0%, #404040 100%)',
      success: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      error: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
    },
  },
};

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (theme: ThemeType) => void;
  themeType: ThemeType;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeType;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'light',
}) => {
  const [themeType, setThemeType] = useState<ThemeType>(defaultTheme);
  const [isLoading, setIsLoading] = useState(true);

  const currentTheme = themes[themeType];

  const setTheme = (newTheme: ThemeType) => {
    setThemeType(newTheme);
    localStorage.setItem('maga-theme', newTheme);
    applyThemeToDOM(themes[newTheme]);
  };

  const applyThemeToDOM = (theme: Theme) => {
    const root = document.documentElement;
    
    // Apply CSS custom properties
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value);
    });

    Object.entries(theme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--theme-shadow-${key}`, value);
    });

    Object.entries(theme.gradients).forEach(([key, value]) => {
      root.style.setProperty(`--theme-gradient-${key}`, value);
    });

    // Apply theme class to body
    document.body.className = document.body.className.replace(
      /theme-\w+/g,
      ''
    );
    document.body.classList.add(`theme-${theme.type}`);
  };

  useEffect(() => {
    // Load theme from localStorage on mount
    const savedTheme = localStorage.getItem('maga-theme') as ThemeType;
    if (savedTheme && themes[savedTheme]) {
      setThemeType(savedTheme);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Apply theme whenever it changes
    if (!isLoading) {
      applyThemeToDOM(currentTheme);
    }
  }, [currentTheme, isLoading]);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        setTheme,
        themeType,
        isLoading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};