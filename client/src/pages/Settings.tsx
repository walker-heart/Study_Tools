import { useSettings } from "@/contexts/SettingsContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useNotification } from "@/components/ui/notification";

export default function Settings() {
  const { theme, setTheme } = useSettings();
  const { showNotification } = useNotification();
  const [apiKey, setApiKey] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiStats, setApiStats] = useState({
    total_requests: 0,
    total_tokens: 0,
    total_cost: 0,
    failed_requests: 0,
    success_rate: 100
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const fetchApiStats = async () => {
    setIsLoadingStats(true);
    try {
      const response = await fetch('/api/user/api-stats?days=30', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        const totalRequests = data.total_requests || 0;
        const failedRequests = data.failed_requests || 0;
        const successRate = totalRequests > 0 
          ? ((totalRequests - failedRequests) / totalRequests * 100).toFixed(1)
          : 100;
        
        setApiStats({
          total_requests: totalRequests,
          total_tokens: data.total_tokens || 0,
          total_cost: data.total_cost || 0,
          failed_requests: failedRequests,
          success_rate: parseFloat(successRate.toString())
        });
      }
    } catch (error) {
      console.error('Failed to fetch API stats:', error);
      showNotification({
        message: 'Failed to fetch API usage statistics',
        type: 'error'
      });
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    // Fetch the API key and stats on component mount
    const fetchInitialData = async () => {
      try {
        const response = await fetch('/api/user/openai-key', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setApiKey(data.apiKey || '');
        }
      } catch (error) {
        console.error('Failed to fetch API key:', error);
      }
      
      // Fetch initial stats
      fetchApiStats();
    };
    fetchInitialData();
  }, []);

  return (
    <div className={`container mx-auto px-4 py-8 max-w-4xl ${theme === 'dark' ? 'dark bg-gray-900 text-white' : ''}`}>
      <h1 className="text-3xl font-bold text-center mb-8">
        Settings
      </h1>

      <div className="space-y-8">
        {/* Theme Toggle at Top */}
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

        {/* Account Settings at Bottom */}
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
                    alert('Failed to sign out. Please try again.');
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
              <p className="text-sm text-gray-500">Contact support to change your email address</p>
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
      {/* OpenAI API Key Section */}
        <Card className={`p-6 mt-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
          <h2 className="text-xl font-semibold mb-4">API Keys</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai-api-key">OpenAI API Key</Label>
              <Input
                id="openai-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="font-mono"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your OpenAI API key will be stored securely and used for AI-powered features
              </p>
            </div>
            <Button 
              onClick={async () => {
                setIsLoading(true);
                try {
                  const response = await fetch('/api/user/openai-key', {
                    method: 'PUT',
                    credentials: 'include',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ apiKey })
                  });

                  if (response.ok) {
                    showNotification({
                      message: 'API key updated successfully',
                      type: 'success'
                    });
                  } else {
                    throw new Error('Failed to update API key');
                  }
                } catch (error) {
                  showNotification({
                    message: 'Failed to update API key',
                    type: 'error'
                  });
                  console.error('Error updating API key:', error);
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Updating...' : 'Update API Key'}
            </Button>

            {/* API Usage Statistics */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4">API Usage Statistics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Requests</div>
                  <div className="text-2xl font-semibold mt-1">
                    {isLoadingStats ? "Loading..." : apiStats.total_requests.toLocaleString()}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Tokens Used</div>
                  <div className="text-2xl font-semibold mt-1">
                    {isLoadingStats ? "Loading..." : apiStats.total_tokens.toLocaleString()}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Cost</div>
                  <div className="text-2xl font-semibold mt-1">
                    {isLoadingStats ? "Loading..." : `$${apiStats.total_cost.toFixed(2)}`}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Success Rate</div>
                  <div className="text-2xl font-semibold mt-1">
                    {isLoadingStats ? "Loading..." : `${apiStats.success_rate}%`}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={fetchApiStats}
                  disabled={isLoadingStats}
                >
                  {isLoadingStats ? "Refreshing..." : "Refresh Statistics"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
