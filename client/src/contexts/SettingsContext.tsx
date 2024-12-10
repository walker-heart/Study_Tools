import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SettingsContextType {
  fontSize: number;
  setFontSize: (size: number) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  // Memorization tool settings
  showHints: boolean;
  setShowHints: (show: boolean) => void;
  autoAdvance: boolean;
  setAutoAdvance: (auto: boolean) => void;
  autoAdvanceDelay: number;
  setAutoAdvanceDelay: (delay: number) => void;
}

const defaultSettings: SettingsContextType = {
  fontSize: 16,
  setFontSize: () => {},
  fontFamily: 'monospace',
  setFontFamily: () => {},
  theme: 'light',
  setTheme: () => {},
  showHints: true,
  setShowHints: () => {},
  autoAdvance: false,
  setAutoAdvance: () => {},
  autoAdvanceDelay: 3000,
  setAutoAdvanceDelay: () => {}
};

const SettingsContext = createContext<SettingsContextType>(defaultSettings);

function SettingsProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSize] = React.useState<number>(16);
  const [fontFamily, setFontFamily] = React.useState<string>('monospace');
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  
  // Load theme preference on mount and after sign in
  useEffect(() => {
    const loadTheme = async () => {
      try {
        // First try to get theme from the server
        const response = await fetch('/api/user/theme', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          if (data.theme) {
            setTheme(data.theme as 'light' | 'dark');
          }
        } else {
          // If not authenticated, try to get from localStorage
          const savedTheme = localStorage.getItem('theme');
          if (savedTheme === 'light' || savedTheme === 'dark') {
            setTheme(savedTheme);
          }
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      }
    };
    loadTheme();
  }, []);

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Save theme preference when it changes
  const handleThemeChange = React.useCallback(async (newTheme: 'light' | 'dark') => {
    const prevTheme = theme;
    try {
      setTheme(newTheme); // Optimistic update
      
      const response = await fetch('/api/user/theme', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme: newTheme }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save theme preference');
      }

      // Successfully saved
      const data = await response.json();
      if (data.theme !== newTheme) {
        throw new Error('Theme mismatch');
      }
    } catch (error) {
      console.error('Theme update failed:', error);
      setTheme(prevTheme); // Revert to previous theme
      throw error;
    }
  }, [theme]);
  
  // Memorization tool settings
  const [showHints, setShowHints] = React.useState<boolean>(true);
  const [autoAdvance, setAutoAdvance] = React.useState<boolean>(false);
  const [autoAdvanceDelay, setAutoAdvanceDelay] = React.useState<number>(3000); // 3 seconds default

  const value = React.useMemo(() => ({
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    theme,
    setTheme: handleThemeChange,
    showHints,
    setShowHints,
    autoAdvance,
    setAutoAdvance,
    autoAdvanceDelay,
    setAutoAdvanceDelay,
  }), [
    fontSize, setFontSize,
    fontFamily, setFontFamily,
    theme, handleThemeChange,
    showHints, setShowHints,
    autoAdvance, setAutoAdvance,
    autoAdvanceDelay, setAutoAdvanceDelay
  ]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export { SettingsProvider };
