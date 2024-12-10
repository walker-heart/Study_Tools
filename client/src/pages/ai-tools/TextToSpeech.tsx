import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/contexts/SettingsContext";
import { useState } from "react";
import { Mic } from "lucide-react";

export default function TextToSpeech() {
  const { theme } = useSettings();
  const [textToRead, setTextToRead] = useState("");

  return (
    <div className={`container mx-auto px-4 py-8 ${theme === 'dark' ? 'dark' : ''}`}>
      <h1 className="text-3xl font-bold mb-8">Text to Speech</h1>
      <Card className="p-6">
        <div className="space-y-4">
          <Textarea
            placeholder="Enter text to convert to speech..."
            value={textToRead}
            onChange={(e) => setTextToRead(e.target.value)}
            className="min-h-[200px]"
          />
          <Button
            disabled={!textToRead.trim()}
            className="w-full"
          >
            <Mic className="w-4 h-4 mr-2" />
            Convert to Speech
          </Button>
        </div>
      </Card>
    </div>
  );
}
