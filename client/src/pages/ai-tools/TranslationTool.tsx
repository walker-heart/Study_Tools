import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNotification } from "@/components/ui/notification";
import { Loader2 } from "lucide-react";

export default function TranslationTool() {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [selectedTense, setSelectedTense] = useState("neutral");
  const [isTranslating, setIsTranslating] = useState(false);
  const [, setLocation] = useLocation();
  const { showNotification } = useNotification();

  const tenseOptions = [
    { value: "neutral", label: "Natural Tense" },
    { value: "present", label: "Present Tense" },
    { value: "past", label: "Past Tense" },
    { value: "future", label: "Future Tense" },
  ];

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
    { code: "zh", name: "Chinese" },
  ];

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
          tense: selectedTense,
        }),
        credentials: 'include'
      });

      let data;
      try {
        const contentType = response.headers.get('content-type');
        if (!contentType?.toLowerCase().includes('application/json')) {
          console.error('Invalid content type:', contentType);
          throw new Error('Unexpected server response format');
        }
        data = await response.json();
      } catch (parseError) {
        console.error('Response parsing error:', parseError);
        throw new Error('Failed to process server response. Please try again.');
      }

      if (!response.ok) {
        const errorMessage = data.details || data.message || "Translation failed";
        console.log('Translation error response:', { status: response.status, data });
        
        if (response.status === 400 && errorMessage.includes("API key")) {
          showNotification({
            message: "OpenAI API key not configured. Please configure it in settings.",
            type: "error",
          });
          setLocation("/settings/api");
          return;
        }
        
        if (response.status === 401) {
          if (errorMessage.includes("OpenAI API key")) {
            showNotification({
              message: "Invalid OpenAI API key. Please check your settings.",
              type: "error",
            });
            setLocation("/settings/api");
          } else {
            showNotification({
              message: "Please sign in to use the translation feature",
              type: "error",
            });
            setLocation("/signin");
          }
          return;
        }
        
        if (response.status === 429) {
          showNotification({
            message: "Too many requests. Please try again later.",
            type: "error",
          });
          return;
        }
        
        throw new Error(errorMessage);
      }

      console.log('Translation response:', data);
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
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Target Language</label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {languages.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Translation Tense</label>
                <Select value={selectedTense} onValueChange={setSelectedTense}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {tenseOptions.map((tense) => (
                        <SelectItem key={tense.value} value={tense.value}>
                          {tense.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
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
