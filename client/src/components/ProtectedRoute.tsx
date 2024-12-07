import { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check', {
          credentials: 'include'
        });
        
        if (!response.ok) {
          setLocation('/signin');
          return;
        }

        const data = await response.json();
        if (!data.authenticated) {
          setLocation('/signin');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setLocation('/signin');
      }
    };

    // Check immediately
    checkAuth();

    // Set up periodic checks every 5 minutes
    const interval = setInterval(checkAuth, 5 * 60 * 1000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [setLocation]);

  return <>{children}</>;
}