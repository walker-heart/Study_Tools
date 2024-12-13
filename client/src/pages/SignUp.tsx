import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { createUser } from '@/lib/firestore';

export default function SignUp() {
  const [, setLocation] = useLocation();
  const { theme } = useSettings();
  const { signUp, signInWithGoogle } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { email, password, firstName, lastName } = formData;
      await signUp(email, password);
      
      // Create user document in Firestore
      await createUser({
        email,
        firstName,
        lastName,
        createdAt: new Date(),
      });
      
      setLocation('/dashboard');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        setError(err.message as string);
      } else {
        setError('Failed to sign up');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      await signInWithGoogle();
      setLocation('/dashboard');
    } catch (err) {
      setError('Failed to sign up with Google');
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
          
          <Button type="submit" className="w-full mb-4" disabled={loading}>
            {loading ? 'Signing Up...' : 'Sign Up with Email'}
          </Button>
          <Button onClick={handleGoogleSignUp} className="w-full">
            Sign Up with Google
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