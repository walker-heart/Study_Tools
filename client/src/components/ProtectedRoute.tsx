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
        });
        
        if (!response.ok) {
          throw new Error('Not authenticated');
        }
        
        // Session is valid, we can continue
        const data = await response.json();
        if (!data.authenticated) {
          throw new Error('Not authenticated');
        }
      } catch (error) {
        // If there's any error or we're not authenticated, redirect to signin
        setLocation('/signin');
      }
    };

    checkAuth();
  }, [setLocation]);

  // We'll show nothing until we verify the authentication
  return <>{children}</>;

  return <>{children}</>;
}
