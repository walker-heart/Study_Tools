import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNotification } from "@/components/ui/notification";
import { Loader2 } from "lucide-react";

// Simple language options
const languages = [
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "nl", name: "Dutch" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" }
];

// Simple translation styles
const translationStyles = [
  { value: "neutral", label: "Natural Translation" },
  { value: "present", label: "Present Tense" },
  { value: "past", label: "Past Tense" },
  { value: "future", label: "Future Tense" }
];

export default function TranslationTool() {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [translationStyle, setTranslationStyle] = useState("neutral");
  const [isTranslating, setIsTranslating] = useState(false);
  const [customization, setCustomization] = useState("");
  const [, setLocation] = useLocation();
  const { showNotification } = useNotification();

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      showNotification({
        message: "Please enter text to translate",
        type: "error",
      });
      return;
    }

    setIsTranslating(true);
    try {
      const response = await fetch("/api/ai/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: sourceText,
          targetLanguage,
          tense: translationStyle,
          customization: customization.trim(),
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMessage = data.details || data.message || "Translation failed";
        if (response.status === 400 && errorMessage.includes("API key")) {
          showNotification({
            message: "OpenAI API key not configured. Please configure it in settings.",
            type: "error",
          });
          setLocation("/settings/api");
          return;
        }
        if (response.status === 401) {
          showNotification({
            message: errorMessage.includes("OpenAI API key") 
              ? "Invalid OpenAI API key. Please check your settings." 
              : "Please sign in to use the translation feature",
            type: "error",
          });
          setLocation(errorMessage.includes("OpenAI API key") ? "/settings/api" : "/signin");
          return;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (!data?.translation) {
        throw new Error("Invalid translation response from server");
      }

      setTranslatedText(data.translation);
      showNotification({
        message: "Text translated successfully",
        type: "success",
      });
    } catch (error) {
      console.error("Translation error:", error);
      showNotification({
        message: error instanceof Error ? error.message : "Failed to translate text. Please try again.",
        type: "error",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">AI Translation Tool</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Source Text</label>
              <Textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Enter text to translate..."
                className="min-h-[200px]"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Target Language</label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Translation Style</label>
                <Select value={translationStyle} onValueChange={setTranslationStyle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    {translationStyles.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Custom Instructions (Optional)</label>
              <Textarea
                value={customization}
                onChange={(e) => setCustomization(e.target.value)}
                placeholder="Add any specific translation instructions..."
                className="min-h-[100px]"
              />
            </div>

            <Button 
              onClick={handleTranslate} 
              disabled={isTranslating || !sourceText.trim()}
              className="w-full"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Translating...
                </>
              ) : (
                "Translate"
              )}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Translation</label>
              <Textarea
                value={translatedText}
                readOnly
                placeholder="Translation will appear here..."
                className="min-h-[200px]"
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}