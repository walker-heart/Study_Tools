import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';

export default function SignIn() {
  const [, setLocation] = useLocation();
  const { theme } = useSettings();
  const { signIn, signInWithGoogle } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      await signIn(formData.email, formData.password);
      setLocation('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      setLocation('/dashboard');
    } catch (err) {
      setError('Failed to sign in with Google');
    }
  };

  return (
    <div className={`container mx-auto px-4 py-8 max-w-md ${theme === 'dark' ? 'dark' : ''}`}>
      <h1 className="text-3xl font-bold text-center mb-8">Sign In</h1>
      
      <Card className={`p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isLoading}
              className="bg-background"
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
              disabled={isLoading}
              className="bg-background"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          
          <Button type="submit" className="w-full mb-4" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign In with Email'}
          </Button>

          <Button 
            type="button"
            onClick={handleGoogleSignIn} 
            className="w-full"
            disabled={isLoading}
          >
            Sign In with Google
          </Button>

          <div className="text-center mt-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Don't have an account?{' '}
              <Button 
                variant="link" 
                onClick={() => setLocation('/signup')} 
                className="text-sm"
                disabled={isLoading}
              >
                Sign Up
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
