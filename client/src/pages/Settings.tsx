import { useSettings } from "@/contexts/SettingsContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function Settings() {
  const { theme, setTheme } = useSettings();

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
            variant={theme === 'dark' ? 'outline' : 'default'}
            className={`w-32 ${
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
            variant={theme === 'dark' ? 'outline' : 'default'}
            className={`w-32 ${
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
              <Button 
                variant={theme === 'dark' ? 'outline' : 'default'}
                className="w-full"
              >
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
