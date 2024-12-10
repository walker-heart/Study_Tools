import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';

export default function Landing() {
  const [, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { theme } = useSettings();

  // Check authentication status first
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/auth/check', {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated) {
            setLocation('/dashboard');
            return;
          }
        }
        setIsAuthenticated(false);
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [setLocation]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Only render content after authentication check is complete
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-4 ${theme === 'dark' ? 'dark bg-gray-900 text-white' : 'bg-gray-50'}`}>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Study Tools Hub</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          Your personal learning assistant for better memorization and study
        </p>
      </div>

      <div className="w-full max-w-md space-y-4">
        <Card className={`p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">Welcome</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Get started with your study journey
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => setLocation('/signin')}
                className="w-full"
                variant="default"
              >
                Sign In
              </Button>
              <Button
                onClick={() => setLocation('/signup')}
                className="w-full"
                variant="outline"
              >
                Create Account
              </Button>
            </div>
          </div>
        </Card>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Study Tools Hub helps you create flashcards and memorize text efficiently.
            Join now to start improving your study habits!
          </p>
        </div>
      </div>
    </div>
  );
}
