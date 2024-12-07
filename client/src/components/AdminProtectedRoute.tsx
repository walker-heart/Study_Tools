import { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';

interface AdminProtectedRouteProps {
  children: ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const checkAdminAuth = async () => {
      try {
        const response = await fetch('/api/auth/check-admin', {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        
        if (!response.ok) {
          throw new Error('Not authorized');
        }
        
        const data = await response.json();
        if (!data.isAdmin) {
          throw new Error('Not authorized');
        }
      } catch (error) {
        console.error('Admin auth check error:', error);
        setLocation('/dashboard');
      }
    };

    checkAdminAuth();
  }, [setLocation]);

  return <>{children}</>;
}
