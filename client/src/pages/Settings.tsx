import { useSettings } from "@/contexts/SettingsContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useNotification } from "@/components/ui/notification";
import { useState, useEffect } from "react";

export default function Settings() {
  const { theme, setTheme } = useSettings();
  const { showNotification } = useNotification();
  const [location, setLocation] = useLocation();
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyPreview, setApiKeyPreview] = useState('');
  
  useEffect(() => {
    const fetchApiKeyStatus = async () => {
      try {
        const response = await fetch('/api/user/openai-key', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setHasApiKey(!!data.hasKey);
          if (data.hasKey && data.key) {
            setApiKeyPreview(`sk-...${data.key.slice(-4)}`);
          } else {
            setApiKeyPreview('');
          }
        } else {
          setHasApiKey(false);
          setApiKeyPreview('');
        }
      } catch (error) {
        console.error('Failed to fetch API key status:', error);
        setHasApiKey(false);
        setApiKeyPreview('');
      }
    };
    
    if (location === "/settings/api") {
      fetchApiKeyStatus();
    }
  }, [location]);

  return (
    <div className={`container mx-auto px-4 py-8 max-w-4xl ${theme === 'dark' ? 'dark bg-gray-900 text-white' : ''}`}>
      <h1 className="text-3xl font-bold text-center mb-4">
        Settings
      </h1>
      {location === "/settings/api" && (
        <div className="mb-4">
          <div className="max-w-md mx-auto p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="space-y-2">
              <div className="flex justify-center">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  hasApiKey 
                    ? 'bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-300' 
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800/30 dark:text-yellow-300'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      hasApiKey ? 'bg-green-500' : 'bg-yellow-500'
                    }`} />
                    OpenAI API Key: {hasApiKey ? 'Configured' : 'Not Configured'}
                  </div>
                </span>
              </div>
              {hasApiKey && apiKeyPreview && (
                <div className={`text-sm font-mono mt-3 p-3 rounded-md text-center ${
                  theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'
                }`}>
                  {apiKeyPreview}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex justify-center gap-4 mb-8">
        <Button
          variant="outline"
          onClick={() => setLocation("/settings")}
          className={`w-32 ${location === "/settings" 
            ? theme === 'dark' ? "bg-white text-black hover:bg-gray-100" : "bg-gray-900 text-white hover:bg-gray-800"
            : theme === 'dark' ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-white text-black hover:bg-gray-100"}`}
        >
          General
        </Button>
        <Button
          variant="outline"
          onClick={() => setLocation("/settings/api")}
          className={`w-32 ${location === "/settings/api" 
            ? theme === 'dark' ? "bg-white text-black hover:bg-gray-100" : "bg-gray-900 text-white hover:bg-gray-800"
            : theme === 'dark' ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-white text-black hover:bg-gray-100"}`}
        >
          API
        </Button>
      </div>

      <div className="space-y-8">
        {/* Theme Toggle */}
        <div className="flex justify-center gap-4 items-center">
          <Button
            size="lg"
            onClick={async () => {
              try {
                await setTheme('light');
              } catch (error) {
                console.error('Failed to set light theme:', error);
              }
            }}
            className={`w-32 bg-white text-gray-900 border-2 border-gray-300 hover:bg-gray-100 ${
              theme === 'light' ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            ☀️ Light
          </Button>
          <Button
            size="lg"
            onClick={async () => {
              try {
                await setTheme('dark');
              } catch (error) {
                console.error('Failed to set dark theme:', error);
              }
            }}
            className={`w-32 bg-gray-900 text-white hover:bg-gray-800 ${
              theme === 'dark' ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            🌙 Dark
          </Button>
        </div>

        {/* Account Settings */}
        <Card className={`p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
          <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
          <div className="space-y-6">
            <div className="space-y-2 pb-4 border-b">
              <Button 
                onClick={async () => {
                  try {
                    const response = await fetch('/api/auth/signout', {
                      method: 'POST',
                      credentials: 'include',
                      headers: {
                        'Content-Type': 'application/json'
                      }
                    });
                    
                    if (response.ok) {
                      // Clear all client-side storage
                      localStorage.clear();
                      sessionStorage.clear();
                      
                      // Clear cookies by setting them to expire
                      document.cookie.split(";").forEach((c) => {
                        document.cookie = c
                          .replace(/^ +/, "")
                          .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
                      });
                      
                      // Force reload to clear React Query cache and reset app state
                      window.location.href = '/';
                    } else {
                      const data = await response.json();
                      throw new Error(data.message || 'Failed to sign out');
                    }
                  } catch (error) {
                    console.error('Sign out error:', error);
                    showNotification({
                      message: 'Failed to sign out. Please try again.',
                      type: 'error'
                    });
                  }
                }}
                variant="outline"
                className="w-full"
              >
                Sign Out
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="your.email@example.com"
                disabled
                className="bg-gray-100 dark:bg-gray-700"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">Contact support to change your email address</p>
            </div>

            <div className="space-y-2">
              <Label>Change Password</Label>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Current password"
                />
                <Input
                  type="password"
                  placeholder="New password"
                />
                <Input
                  type="password"
                  placeholder="Confirm new password"
                />
              </div>
              <Button className="w-full">
                Update Password
              </Button>
            </div>

            <div className="pt-4 border-t">
              <Button 
                variant="destructive" 
                className={`w-full ${theme === 'dark' ? 'hover:bg-red-900' : ''}`}
              >
                Delete Account
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
