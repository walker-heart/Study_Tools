import { SelectValue, SelectTrigger, SelectContent, SelectItem, Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useSettings } from "@/contexts/SettingsContext";

export default function MemorizationSettings() {
  const {
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    theme,
  } = useSettings();

  const fontOptions = [
    { value: 'monospace', label: 'Monospace' },
    { value: 'inter', label: 'Inter' },
    { value: 'system-ui', label: 'System' },
  ];

  return (
    <div className={`w-full max-w-xl mx-auto p-4 ${theme === 'dark' ? 'text-white' : ''}`}>
      <div className="flex items-center gap-8">
        <div className="flex-1 space-y-1">
          <Label className="text-sm">Font Size</Label>
          <div className="flex items-center gap-4">
            <Slider
              value={[fontSize]}
              onValueChange={([value]) => setFontSize(value)}
              min={12}
              max={24}
              step={1}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground w-12 text-right">
              {fontSize}px
            </span>
          </div>
        </div>

        <div className="w-48">
          <Label className="text-sm">Font</Label>
          <Select value={fontFamily} onValueChange={setFontFamily}>
            <SelectTrigger className="h-8">
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
      </div>
    </div>
  );
}
