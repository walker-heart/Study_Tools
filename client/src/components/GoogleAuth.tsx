import React from 'react';
import { Button } from '@/components/ui/button';

interface GoogleAuthProps {
  className?: string;
}

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="currentColor"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="currentColor"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="currentColor"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export function GoogleAuth({ className = '' }: GoogleAuthProps) {
  const handleGoogleAuth = () => {
    try {
      // Handle different environments appropriately
      const baseUrl = window.location.origin;
  const apiUrl = `${baseUrl}/api/auth/google`;
  console.log('Google Auth URL:', apiUrl);
      
      // Add state parameter for additional security
      const state = crypto.getRandomValues(new Uint8Array(16))
        .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
      
      const finalUrl = `${apiUrl}?state=${state}`;
      window.location.href = finalUrl;
      
    } catch (error) {
      console.error('Error initiating Google auth:', error);
      // Redirect to error page or show error message
      window.location.href = '/signin?error=auth_init_failed';
    }
  };

  return (
    <Button
      variant="outline"
      className={`w-full h-11 px-4 bg-white dark:bg-white text-gray-700 border border-gray-300 
        hover:bg-gray-50 dark:hover:bg-gray-50 
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors duration-200
        flex items-center justify-center gap-3 ${className}`}
      onClick={handleGoogleAuth}
    >
      <GoogleIcon />
      <span className="text-[14px] font-medium font-roboto tracking-wide">Continue with Google</span>
    </Button>
  );
}
