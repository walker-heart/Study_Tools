import { createContext, useContext, useState, useEffect, ReactNode } from "react";

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

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSize] = useState<number>(16);
  const [fontFamily, setFontFamily] = useState<string>('monospace');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // Load theme preference on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const response = await fetch('/api/user/theme', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          if (data.theme) {
            setTheme(data.theme as 'light' | 'dark');
          }
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      }
    };
    loadTheme();
  }, []);

  // Save theme preference when it changes
  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    try {
      const response = await fetch('/api/user/theme', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme: newTheme }),
      });
      if (response.ok) {
        setTheme(newTheme);
      }
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };
  
  // Memorization tool settings
  const [showHints, setShowHints] = useState<boolean>(true);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(false);
  const [autoAdvanceDelay, setAutoAdvanceDelay] = useState<number>(3000); // 3 seconds default

  return (
    <SettingsContext.Provider
      value={{
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
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
