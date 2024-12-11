import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSettings } from "@/contexts/SettingsContext";
import { useLocation } from "wouter";
import { Image, Mic, BookOpen, Languages } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useEffect, useState } from "react";
import { useNotification } from "@/components/ui/notification";

export default function AITools() {
  const { theme } = useSettings();
  const [, setLocation] = useLocation();
  const { showNotification } = useNotification();
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const response = await fetch('/api/user/openai-key', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setHasApiKey(!!data.hasKey);
        } else {
          setHasApiKey(false);
        }
      } catch (error) {
        console.error('Failed to check API key:', error);
        setHasApiKey(false);
      }
    };
    checkApiKey();
  }, []);

  const handleCardClick = (route: string) => {
    // If no API key is configured, redirect to API settings page
    if (!hasApiKey) {
      setLocation("/settings/api");
      return;
    }
    // Otherwise navigate to the selected tool
    setLocation(route);
  };

  return (
    <div className={`container mx-auto px-4 py-8 ${theme === 'dark' ? 'dark' : ''}`}>
      <h1 className="text-3xl font-bold mb-8">AI Tools</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Image to Text Tool */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleCardClick('/ai-tools/image')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              Image to Text
            </CardTitle>
            <CardDescription>Extract text from images using AI</CardDescription>
          </CardHeader>
        </Card>

        {/* Text to Speech Tool */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleCardClick('/ai-tools/tts')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Text to Speech
            </CardTitle>
            <CardDescription>Convert text to natural speech</CardDescription>
          </CardHeader>
        </Card>

        {/* Practice Quiz Creator */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleCardClick('/ai-tools/quiz')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Practice Quiz Creator
            </CardTitle>
            <CardDescription>Generate quizzes with AI</CardDescription>
          </CardHeader>
        </Card>

        {/* Translation Tool */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleCardClick('/ai-tools/translate')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="w-5 h-5" />
              AI Translation
            </CardTitle>
            <CardDescription>Translate text into multiple languages</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
