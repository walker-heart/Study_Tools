import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SelectValue, SelectTrigger, SelectContent, SelectItem, Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

import { useSettings } from "@/contexts/SettingsContext";

export default function MemorizationSettings() {
  const { fontSize, setFontSize, fontFamily, setFontFamily, theme, setTheme } = useSettings();
  const [isOpen, setIsOpen] = useState(false);

  const fontOptions = [
    { value: 'monospace', label: 'Monospace' },
    { value: 'inter', label: 'Inter' },
    { value: 'system-ui', label: 'System' },
  ];

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="mb-2"
      >
        ⚙️ Settings {isOpen ? '▼' : '▶'}
      </Button>
      
      {isOpen && (
        <Card className={`p-4 w-64 shadow-lg ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Font Size</Label>
              <Slider
                value={[fontSize]}
                onValueChange={([value]) => setFontSize(value)}
                min={12}
                max={24}
                step={1}
                className="w-full"
              />
              <div className="text-sm text-gray-500 text-right">
                {fontSize}px
              </div>
            </div>

            <div className="space-y-2">
              <Label>Font Family</Label>
              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a font" />
                </SelectTrigger>
                <SelectContent>
                  {fontOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="flex gap-2">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('light')}
                  className="flex-1"
                >
                  Light
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTheme('dark')}
                  className="flex-1"
                >
                  Dark
                </Button>
              </div>
            </div>

            {/* Tool-specific settings */}
            <div className="space-y-2 mt-4 pt-4 border-t">
              <Label>Memorization Settings</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Show Hints</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-16"
                    onClick={() => {/* TODO: Implement hint toggling */}}
                  >
                    Yes
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Auto-advance</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-16"
                    onClick={() => {/* TODO: Implement auto-advance toggling */}}
                  >
                    Off
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
