import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/contexts/SettingsContext";
import { useNotification } from "@/components/ui/notification";
import { useLocation } from "wouter";

export default function APIManagement() {
  const { theme } = useSettings();
  const { showNotification } = useNotification();
  const [apiKey, setApiKey] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
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
      <h1 className="text-3xl font-bold text-center mb-4">
        Settings
      </h1>

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
        <Card className={`p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
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
