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
  const [location, setLocation] = useLocation();
  const [apiStats, setApiStats] = useState({
    total_requests: 0,
    total_tokens: 0,
    total_cost: 0,
    failed_requests: 0,
    success_rate: 100,
    text_requests: 0,
    image_requests: 0,
    speech_requests: 0
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
          success_rate: parseFloat(successRate.toString()),
          text_requests: data.text_requests || 0,
          image_requests: data.image_requests || 0,
          speech_requests: data.speech_requests || 0
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
          className={`w-32 ${location[0] === "/settings" 
            ? theme === 'dark' ? "bg-white text-black hover:bg-gray-200" : "bg-gray-900 text-white hover:bg-gray-700"
            : theme === 'dark' ? "bg-gray-700 text-white hover:bg-gray-600" : "bg-white text-black hover:bg-gray-100"}`}
        >
          General
        </Button>
        <Button
          variant="outline"
          onClick={() => setLocation("/settings/api")}
          className={`w-32 ${location.includes("/settings/api")
            ? theme === 'dark' ? "bg-white text-black hover:bg-gray-200" : "bg-gray-900 text-white hover:bg-gray-700"
            : theme === 'dark' ? "bg-gray-700 text-white hover:bg-gray-600" : "bg-white text-black hover:bg-gray-100"}`}
        >
          API
        </Button>
      </div>

      <div className="space-y-8">
        <Card className={`p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
          <h2 className="text-xl font-semibold mb-4">API Keys</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="openai-api-key">OpenAI API Key</Label>
                <span className={`text-sm px-2 py-1 rounded ${apiKey ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'}`}>
                  {apiKey ? 'Configured' : 'Not Configured'}
                </span>
              </div>
              <Input
                id="openai-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className={`font-mono ${!apiKey ? 'border-yellow-500 dark:border-yellow-400' : ''}`}
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your OpenAI API key will be stored securely and used for AI-powered features. 
                {!apiKey && <span className="text-yellow-600 dark:text-yellow-400"> Required for AI features.</span>}
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
              <h3 className="text-lg font-semibold mb-4">API Usage Statistics (Last 30 Days)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Requests</div>
                  <div className="text-2xl font-semibold mt-1">
                    {isLoadingStats ? "Loading..." : apiStats.total_requests.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Text: {isLoadingStats ? "..." : (apiStats.text_requests || 0).toLocaleString()} •
                    Image: {isLoadingStats ? "..." : (apiStats.image_requests || 0).toLocaleString()} •
                    Speech: {isLoadingStats ? "..." : (apiStats.speech_requests || 0).toLocaleString()}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Tokens Used</div>
                  <div className="text-2xl font-semibold mt-1">
                    {isLoadingStats ? "Loading..." : apiStats.total_tokens.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Average: {isLoadingStats ? "..." : 
                      Math.round(apiStats.total_tokens / (apiStats.text_requests || 1)).toLocaleString()} tokens/request
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Cost</div>
                  <div className="text-2xl font-semibold mt-1">
                    {isLoadingStats ? "Loading..." : `$${parseFloat(apiStats.total_cost.toString()).toFixed(2)}`}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Average: ${isLoadingStats ? "..." : 
                      (parseFloat(apiStats.total_cost.toString()) / (apiStats.total_requests || 1)).toFixed(4)}/request
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Success Rate</div>
                  <div className="text-2xl font-semibold mt-1">
                    {isLoadingStats ? "Loading..." : `${apiStats.success_rate}%`}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Failed: {isLoadingStats ? "..." : apiStats.failed_requests.toLocaleString()} requests
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={fetchApiStats}
                  disabled={isLoadingStats}
                >
                  {isLoadingStats ? "Refreshing..." : "Refresh Statistics"}
                </Button>
                <Button
                  variant="default"
                  className="w-full"
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/user/test-openai', {
                        method: 'POST',
                        credentials: 'include'
                      });
                      
                      if (!response.ok) {
                        throw new Error('Failed to test API');
                      }
                      
                      const data = await response.json();
                      showNotification({
                        message: `Test successful! Response: ${data.response}. Tokens used: ${data.tokensUsed}`,
                        type: 'success'
                      });
                      
                      // Refresh stats after successful test
                      fetchApiStats();
                    } catch (error) {
                      showNotification({
                        message: 'Failed to test OpenAI API',
                        type: 'error'
                      });
                    }
                  }}
                >
                  Test API Call
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
