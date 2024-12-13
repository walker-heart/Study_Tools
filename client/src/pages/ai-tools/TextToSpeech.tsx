import { useState, useRef, ChangeEvent } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/contexts/SettingsContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Mic, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Define interfaces for API responses
interface TTSErrorResponse {
  details?: string;
  message?: string;
  error?: string;
}

interface TTSRequestBody {
  text: string;
  voice: string;
}

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
  const [, setLocation] = useLocation();
  const [textToRead, setTextToRead] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("alloy");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        setTextToRead(result);
      }
    };
    
    reader.onerror = (error: ProgressEvent<FileReader>) => {
      toast({
        title: "Error",
        description: `Error reading file: ${error.target?.error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    };
    
    reader.readAsText(file);
  };

  const handleGenerate = async () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      // Validate input
      if (!textToRead.trim()) {
        toast({
          title: "Error",
          description: "Please enter some text to convert to speech",
          variant: "destructive",
        });
        return;
      }

      // Set processing state
      setIsProcessing(true);
      toast({
        title: "Processing",
        description: "Generating speech...",
      });

      const response = await fetch('/api/user/generate-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textToRead,
          voice: selectedVoice,
        }),
        credentials: 'include'
      });

      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.details || errorData.message || "Speech generation failed";
        
        if (response.status === 400 && errorMessage.includes("API key")) {
          toast({
            title: "API Key Required",
            description: "OpenAI API key not configured. Please configure it in settings.",
            variant: "destructive",
          });
          setLocation("/settings/api");
          return;
        }
        
        if (response.status === 401) {
          if (errorMessage.includes("OpenAI API key")) {
            toast({
              title: "Invalid API Key",
              description: "Please check your API key in settings.",
              variant: "destructive",
            });
            setLocation("/settings/api");
          } else {
            toast({
              title: "Authentication Required",
              description: "Please sign in to use this feature.",
              variant: "destructive",
            });
            setLocation("/signin");
          }
          return;
        }
        
        if (response.status === 429) {
          toast({
            title: "Rate Limit Exceeded",
            description: "Too many requests. Please try again later.",
            variant: "destructive",
          });
          return;
        }
        
        throw new Error(errorMessage);
      }

      // Verify audio response
      if (!contentType?.includes('audio/mpeg')) {
        throw new Error('Server returned non-audio data');
      }

      // Process audio response
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Received empty response from server');
      }

      // Create audio blob and URL
      const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      if (audioBlob.size === 0) {
        throw new Error('Failed to create audio blob');
      }

      const newAudioUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(newAudioUrl);
      
      toast({
        title: "Success",
        description: "Audio generated successfully",
      });

    } catch (error) {
      console.error('Speech generation error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate speech",
        variant: "destructive"
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
            {isProcessing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Mic className="w-4 h-4 mr-2" />
            )}
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
                  const audioElement = e.currentTarget;
                  console.error('Audio playback error:', audioElement.error);
                  toast({
                    title: "Error",
                    description: `Failed to play audio: ${audioElement.error?.message || 'Unknown error'}`,
                    variant: "destructive"
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
