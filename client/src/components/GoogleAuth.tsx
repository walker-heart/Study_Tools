import React from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export function GoogleAuth() {
  const [user, setUser] = React.useState<User | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Check authentication status when component mounts
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('Checking auth status...');
      const response = await fetch('/auth/status', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      console.log('Auth status response:', response.status);
      const data = await response.json();
      console.log('Auth status data:', data);
      
      if (data.authenticated) {
        setUser(data.user);
        setError(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setError('Failed to check authentication status');
    }
  };

  const handleAuth = (type: 'signin' | 'signup') => {
    console.log(`Initiating Google ${type}...`);
    // Add a prompt parameter to differentiate between sign in and sign up
    window.location.href = `/auth/google?prompt=${type}`;
  };

  const handleLogout = async () => {
    try {
      console.log('Logging out...');
      const response = await fetch('/auth/logout', {
        credentials: 'include'
      });
      console.log('Logout response:', response.status);
      
      if (response.ok) {
        setUser(null);
        setError(null);
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      console.error('Error logging out:', error);
      setError('Failed to logout');
    }
  };

  // Show error if any
  if (error) {
    return (
      <div className="text-red-600 mb-4">
        Error: {error}
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <img
          src={user.picture}
          alt={user.name}
          className="w-8 h-8 rounded-full"
        />
        <span>{user.name}</span>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    );
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

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => handleAuth('signin')}
        className="flex items-center justify-center gap-2 px-6 py-2 text-gray-700 bg-white rounded-lg shadow hover:bg-gray-50 min-w-[200px]"
      >
        <GoogleIcon />
        Sign in with Google
      </button>
      <button
        onClick={() => handleAuth('signup')}
        className="flex items-center justify-center gap-2 px-6 py-2 text-white bg-blue-600 rounded-lg shadow hover:bg-blue-700 min-w-[200px]"
      >
        <GoogleIcon />
        Sign up with Google
      </button>
    </div>
  );
}
