import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/contexts/SettingsContext";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Mic, Upload } from "lucide-react";

const VOICE_OPTIONS = [
  { value: "alloy", label: "Alloy" },
  { value: "echo", label: "Echo" },
  { value: "fable", label: "Fable" },
  { value: "onyx", label: "Onyx" },
  { value: "nova", label: "Nova" },
  { value: "shimmer", label: "Shimmer" },
];

export default function TextToSpeech() {
  const { theme } = useSettings();
  const [textToRead, setTextToRead] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("alloy");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      // Read file content and set it to textToRead
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setTextToRead(event.target.result as string);
        }
      };
      reader.readAsText(e.target.files[0]);
    }
  };

  const handleGenerate = async () => {
    if (!textToRead.trim()) return;
    setIsProcessing(true);
    try {
      // API call implementation will be added later
      console.log("Generating speech with voice:", selectedVoice);
    } catch (error) {
      console.error("Failed to generate speech:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`container mx-auto px-4 py-8 ${theme === 'dark' ? 'dark' : ''}`}>
      <h1 className="text-3xl font-bold mb-8">Text to Speech</h1>
      <Card className="p-6">
        <CardContent className="space-y-6">
          {/* Voice Selection */}
          <div className="flex items-center gap-4">
            <div className="w-48">
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_OPTIONS.map((voice) => (
                    <SelectItem key={voice.value} value={voice.value}>
                      {voice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Model and Format (disabled for now) */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">tts-1</span>
              <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">1x</span>
              <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">mp3</span>
            </div>
          </div>

          {/* Text Input Area */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Input
                type="file"
                accept=".txt"
                onChange={handleFileChange}
                className="max-w-[200px]"
              />
            </div>
            <Textarea
              placeholder="Enter text to convert to speech..."
              value={textToRead}
              onChange={(e) => setTextToRead(e.target.value)}
              className="min-h-[200px] font-mono"
            />
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={!textToRead.trim() || isProcessing}
            className="w-full"
          >
            <Mic className="w-4 h-4 mr-2" />
            {isProcessing ? "Generating..." : "Generate"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
