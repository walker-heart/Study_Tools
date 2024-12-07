import { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLocation('/signin');
        return;
      }

      try {
        // Verify token client-side
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        const expirationTime = tokenData.exp * 1000; // Convert to milliseconds
        
        if (Date.now() >= expirationTime) {
          // Token has expired
          localStorage.removeItem('token');
          setLocation('/signin');
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.removeItem('token');
        setLocation('/signin');
      }
    };

    // Check immediately
    checkAuth();

    // Set up periodic checks every minute
    const interval = setInterval(checkAuth, 60 * 1000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [setLocation]);

  return <>{children}</>;
}