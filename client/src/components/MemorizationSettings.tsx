import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SelectValue, SelectTrigger, SelectContent, SelectItem, Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface MemorizationSettingsProps {
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  fontFamily: string;
  onFontFamilyChange: (font: string) => void;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

export default function MemorizationSettings({
  fontSize,
  onFontSizeChange,
  fontFamily,
  onFontFamilyChange,
  theme,
  onThemeChange,
}: MemorizationSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const fontOptions = [
    { value: 'monospace', label: 'Monospace' },
    { value: 'inter', label: 'Inter' },
    { value: 'system-ui', label: 'System' },
  ];

  return (
    <div className="fixed top-4 right-4 z-50">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="mb-2"
      >
        ⚙️ Settings
      </Button>

      {isOpen && (
        <Card className={`p-4 w-64 shadow-lg ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Font Size</Label>
              <Slider
                value={[fontSize]}
                onValueChange={([value]) => onFontSizeChange(value)}
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
              <Select value={fontFamily} onValueChange={onFontFamilyChange}>
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
                  onClick={() => onThemeChange('light')}
                  className="flex-1"
                >
                  Light
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onThemeChange('dark')}
                  className="flex-1"
                >
                  Dark
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
