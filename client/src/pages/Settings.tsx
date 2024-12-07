import { useSettings } from "@/contexts/SettingsContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function Settings() {
  const { theme, setTheme } = useSettings();

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className={`text-3xl font-bold text-center mb-8 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Settings
        </h1>

        <div className="space-y-8">
          {/* Theme Toggle */}
          <div className="flex justify-center gap-4 items-center">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              size="lg"
              onClick={async () => {
                try {
                  await setTheme('light');
                } catch (error) {
                  console.error('Failed to set light theme:', error);
                }
              }}
              className={`w-32 ${theme === 'light' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              ☀️ Light
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              size="lg"
              onClick={async () => {
                try {
                  await setTheme('dark');
                } catch (error) {
                  console.error('Failed to set dark theme:', error);
                }
              }}
              className={`w-32 ${theme === 'dark' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              🌙 Dark
            </Button>
          </div>

          {/* Account Settings */}
          <Card className="p-6 bg-white shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Account Settings</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-gray-700">Email</Label>
                <Input
                  type="email"
                  placeholder="your.email@example.com"
                  disabled
                  className="bg-gray-50 text-gray-600"
                />
                <p className="text-sm text-gray-500">Contact support to change your email address</p>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-700">Change Password</Label>
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder="Current password"
                    className="bg-white text-gray-900"
                  />
                  <Input
                    type="password"
                    placeholder="New password"
                    className="bg-white text-gray-900"
                  />
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    className="bg-white text-gray-900"
                  />
                </div>
                <Button className="w-full mt-2">
                  Update Password
                </Button>
              </div>

              <div className="pt-4 border-t">
                <Button variant="destructive" className="w-full">
                  Delete Account
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
