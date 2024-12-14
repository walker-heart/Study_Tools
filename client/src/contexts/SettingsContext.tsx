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

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [fontSize, setFontSize] = useState<number>(16);
  const [fontFamily, setFontFamily] = useState<string>('monospace');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  // Load theme preference on mount and after sign in
  useEffect(() => {
    const loadTheme = async () => {
      console.log('Loading theme preferences...');
      
      // First try to get from localStorage for immediate UI update
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
      console.log('Theme from localStorage:', savedTheme);
      
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(savedTheme);
      }

      try {
        // Then try to get theme from the server
        console.log('Fetching theme from server...');
        const response = await fetch('/api/user/theme', {
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        // First check if the response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.log('Server returned non-JSON response, keeping localStorage theme');
          return;
        }

        if (response.ok) {
          const data = await response.json();
          console.log('Server theme response:', data);
          
          const validTheme = data?.theme === 'light' || data?.theme === 'dark';
          if (validTheme) {
            setTheme(data.theme);
            document.documentElement.classList.remove('light', 'dark');
            document.documentElement.classList.add(data.theme);
            localStorage.setItem('theme', data.theme);
            console.log('Theme updated from server:', data.theme);
          } else {
            console.log('Invalid theme from server, keeping localStorage theme');
          }
        } else {
          console.log('Server theme fetch failed, keeping localStorage theme');
        }
      } catch (error) {
        console.error('Failed to load theme from server:', error);
        // Keep using localStorage theme if server fails
      }
    };
    loadTheme();
  }, []);

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Save theme preference when it changes
  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    const prevTheme = theme;
    
    // Update UI immediately for better user experience
    setTheme(newTheme);
    document.documentElement.classList.remove(prevTheme);
    document.documentElement.classList.add(newTheme);
    localStorage.setItem('theme', newTheme);

    try {
      console.log(`Attempting to update theme to: ${newTheme}`);
      const response = await fetch('/api/user/theme', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ theme: newTheme })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update theme');
      }
      
      console.log('Theme preference saved successfully:', data);
      
    } catch (error) {
      console.error('Failed to update theme:', error);
      // Revert the theme if the API call failed
      setTheme(prevTheme);
      document.documentElement.classList.remove(newTheme);
      document.documentElement.classList.add(prevTheme);
      localStorage.setItem('theme', prevTheme);
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

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
