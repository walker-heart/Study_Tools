import { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLocation('/signin');
    }
  }, [setLocation]);

  const token = localStorage.getItem('token');
  if (!token) {
    return null;
  }

  return <>{children}</>;
}
