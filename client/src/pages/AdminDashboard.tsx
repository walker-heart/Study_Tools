import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { theme } = useSettings();

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const response = await fetch('/api/auth/check-admin', {
          credentials: 'include',
        });
        
        if (!response.ok) {
          setLocation('/dashboard');
        }
      } catch (error) {
        console.error('Admin check error:', error);
        setLocation('/dashboard');
      }
    };

    checkAdmin();
  }, [setLocation]);

  return (
    <div className={`container mx-auto px-4 py-8 ${theme === 'dark' ? 'dark bg-gray-900 text-white' : ''}`}>
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className={`p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
          <h2 className="text-xl font-semibold mb-4">User Management</h2>
          <Button 
            onClick={() => setLocation('/admin/users')}
            className="w-full"
          >
            Manage Users
          </Button>
        </Card>

        <Card className={`p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
          <h2 className="text-xl font-semibold mb-4">Analytics</h2>
          <Button 
            onClick={() => setLocation('/admin/analytics')}
            className="w-full"
          >
            View Analytics
          </Button>
        </Card>
      </div>
    </div>
  );
}
