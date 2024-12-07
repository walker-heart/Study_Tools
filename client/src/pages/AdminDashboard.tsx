import { useState } from 'react';
import { useLocation } from 'wouter';
import { 
  Users, 
  BarChart, 
  Settings as SettingsIcon, 
  Shield, 
  BookOpen 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { theme } = useSettings();
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className={`container mx-auto px-4 py-8 ${theme === 'dark' ? 'dark bg-gray-900 text-white' : ''}`}>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Button 
          variant="outline"
          onClick={() => setLocation('/dashboard')}
        >
          Return to App
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className={`p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold mb-2">User Management</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Manage user accounts and permissions
                  </p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
              <Button 
                onClick={() => setActiveTab('users')}
                className="w-full mt-4"
              >
                Manage Users
              </Button>
            </Card>

            <Card className={`p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Analytics</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    View usage statistics and trends
                  </p>
                </div>
                <BarChart className="w-8 h-8 text-green-500" />
              </div>
              <Button 
                onClick={() => setActiveTab('analytics')}
                className="w-full mt-4"
              >
                View Analytics
              </Button>
            </Card>

            <Card className={`p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Study Content</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Manage flashcards and study materials
                  </p>
                </div>
                <BookOpen className="w-8 h-8 text-purple-500" />
              </div>
              <Button 
                onClick={() => setLocation('/admin/content')}
                className="w-full mt-4"
              >
                Manage Content
              </Button>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <Card className={`p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
            <h2 className="text-2xl font-semibold mb-4">User Management</h2>
            {/* User management interface will be implemented here */}
            <p className="text-gray-500 dark:text-gray-400">
              User management interface coming soon...
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card className={`p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
            <h2 className="text-2xl font-semibold mb-4">Analytics Dashboard</h2>
            {/* Analytics interface will be implemented here */}
            <p className="text-gray-500 dark:text-gray-400">
              Analytics dashboard coming soon...
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className={`p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
            <h2 className="text-2xl font-semibold mb-4">Admin Settings</h2>
            {/* Settings interface will be implemented here */}
            <p className="text-gray-500 dark:text-gray-400">
              Admin settings interface coming soon...
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
