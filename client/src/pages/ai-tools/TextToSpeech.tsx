import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/contexts/SettingsContext";
import { useState, useRef } from "react";
import { useNotification } from "@/components/ui/notification";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Mic } from "lucide-react";

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
  const { showNotification } = useNotification();
  const [textToRead, setTextToRead] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("alloy");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setTextToRead(event.target.result as string);
        }
      };
      reader.onerror = (error) => {
        showNotification({
          message: `Error reading file: ${error}`,
          type: 'error'
        });
      };
      reader.readAsText(file);
    }
  };

  const handleGenerate = async () => {
    try {
      // Validate input
      if (!textToRead.trim()) {
        showNotification({
          message: 'Please enter some text to convert to speech',
          type: 'error'
        });
        return;
      }

      // Set processing state
      setIsProcessing(true);
      showNotification({
        message: 'Generating speech...',
        type: 'info'
      });

      // Make API request
      const response = await fetch('/api/user/generate-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textToRead,
          voice: selectedVoice,
        }),
      });

      // Handle API errors
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
      }

      // Process audio response
      const arrayBuffer = await response.arrayBuffer();
      
      // Create audio blob
      const audioBlob = new Blob([arrayBuffer], { 
        type: 'audio/mpeg; codecs="mp3"'
      });
      
      // Validate blob
      if (audioBlob.size === 0) {
        throw new Error('Received empty audio data');
      }

      // Clean up previous audio URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      // Create and validate new audio URL
      const newAudioUrl = URL.createObjectURL(audioBlob);
      
      // Update state and show success message
      setAudioUrl(newAudioUrl);
      showNotification({
        message: 'Audio generated successfully',
        type: 'success'
      });

    } catch (error) {
      console.error('Speech generation error:', error);
      showNotification({
        message: error instanceof Error ? error.message : 'Failed to generate speech',
        type: 'error'
      });
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

          {/* Audio Player */}
          {audioUrl && (
            <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Generated Audio:</p>
              <audio 
                ref={audioRef}
                controls
                className="w-full"
                src={audioUrl}
                onError={(e) => {
                  const audioElement = e.currentTarget as HTMLAudioElement;
                  const errorInfo = {
                    code: audioElement.error?.code,
                    message: audioElement.error?.message,
                    networkState: audioElement.networkState,
                    readyState: audioElement.readyState,
                  };
                  
                  console.error('Audio Error:', errorInfo);
                  
                  showNotification({
                    message: `Audio Error: ${errorInfo.message || 'Unknown error'} (Code: ${errorInfo.code})`,
                    type: 'error'
                  });
                }}
                onEnded={() => {
                  if (audioUrl) {
                    URL.revokeObjectURL(audioUrl);
                    setAudioUrl(null);
                  }
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
