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
  const { showNotification } = useNotification();
  const [textToRead, setTextToRead] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("alloy");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    if (!textToRead.trim()) {
      showNotification({
        message: 'Please enter some text to convert to speech',
        type: 'error'
      });
      return;
    }

    setIsProcessing(true);
    try {
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

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate speech');
      }

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = `Failed to generate speech: ${error.message || 'Unknown error'}
        Status: ${response.status}
        Status Text: ${response.statusText}`;
        showNotification({
          message: errorMessage,
          type: 'error'
        });
        throw new Error(errorMessage);
      }

      // Clean up previous audio URL if it exists
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Get array buffer from response
      const arrayBuffer = await response.arrayBuffer();
      
      // Create a blob with explicit MIME type and codec info
      const audioBlob = new Blob([arrayBuffer], { 
        type: 'audio/mpeg; codecs="mp3"'
      });
      
      if (audioBlob.size === 0) {
        throw new Error('Received empty audio data');
      }
      
      // Create a URL for the blob and verify it's valid
      const newAudioUrl = URL.createObjectURL(audioBlob);
      
      // Validate the audio URL
      const audio = new Audio();
      audio.src = newAudioUrl;
      
      // Only set the URL if the audio loads successfully
      await new Promise((resolve, reject) => {
        audio.addEventListener('loadeddata', () => resolve(true));
        audio.addEventListener('error', reject);
        audio.load();
      });
      
      // Update the audio URL state
      setAudioUrl(newAudioUrl);
      
      showNotification({
        message: 'Audio generated successfully',
        type: 'success'
      });
    } catch (error) {
      console.error("Failed to generate speech:", error);
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
            className="w-full mb-4"
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
                  
                  showNotification({
                    message: `Audio Error: ${audioElement.error?.message || 'Unknown error'} (Code: ${errorInfo.code})
                    Network State: ${errorInfo.networkState}
                    Ready State: ${errorInfo.readyState}`,
                    type: 'error'
                  });
                  
                  // Update the UI to show error state
                  setTextToRead(prev => prev + '\n\nAudio Error Details:\n' + 
                    JSON.stringify(errorInfo, null, 2));
                }}
                onEnded={() => {
                  // Optional: Clean up the audio URL when playback ends
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
