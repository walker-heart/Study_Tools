import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSettings } from "@/contexts/SettingsContext";
import { useLocation } from "wouter";
import { Image, Mic, BookOpen } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";

export default function AITools() {
  const { theme } = useSettings();
  const [, setLocation] = useLocation();

  return (
    <div className={`container mx-auto px-4 py-8 ${theme === 'dark' ? 'dark' : ''}`}>
      <h1 className="text-3xl font-bold mb-8">AI Tools</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Image to Text Tool */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/ai-tools/image')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              Image to Text
            </CardTitle>
            <CardDescription>Extract text from images using AI</CardDescription>
          </CardHeader>
        </Card>

        {/* Text to Speech Tool */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/ai-tools/tts')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Text to Speech
            </CardTitle>
            <CardDescription>Convert text to natural speech</CardDescription>
          </CardHeader>
        </Card>

        {/* Practice Quiz Creator */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setLocation('/ai-tools/quiz')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Practice Quiz Creator
            </CardTitle>
            <CardDescription>Generate quizzes with AI</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
