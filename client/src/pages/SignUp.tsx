import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettings } from '@/contexts/SettingsContext';

export default function SignUp() {
  const [, setLocation] = useLocation();
  const { theme } = useSettings();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
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
          }
        }
      } catch (error) {
        // If there's an error checking auth, we stay on the signup page
        console.error('Auth check error:', error);
      }
    };

    checkAuth();
  }, [setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to sign up');
      }
      
      setLocation('/signin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    }
  };

  return (
    <div className={`container mx-auto px-4 py-8 max-w-md ${theme === 'dark' ? 'dark' : ''}`}>
      <h1 className="text-3xl font-bold text-center mb-8">Sign Up</h1>
      
      <Card className={`p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          
          <Button type="submit" className="w-full">
            Sign Up
          </Button>

          <div className="text-center">
            <span className="text-sm">Already have an account? </span>
            <Button variant="link" onClick={() => setLocation('/signin')} className="text-sm">
              Sign In
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
