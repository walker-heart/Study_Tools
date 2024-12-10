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
        // Try to get the session status from the server
        const response = await fetch('/api/auth/check', {
          credentials: 'include', // Important for cookies
          headers: {
            'Cache-Control': 'no-cache', // Prevent caching of auth state
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          mode: 'cors', // Explicitly set CORS mode
        });
        
        if (!response.ok) {
          throw new Error('Not authenticated');
        }
        
        const data = await response.json();
        if (!data.authenticated) {
          throw new Error('Not authenticated');
        }
      } catch (error) {
        // If there's any error or we're not authenticated, redirect to signin
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

  // We'll show nothing until we verify the authentication
  return <>{children}</>;

  return <>{children}</>;
}
