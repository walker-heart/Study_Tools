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

  // Define tenses for each language
  const languageTenses = {
    es: [
      { value: "neutral", label: "Natural" },
      { value: "present", label: "Present (Presente)" },
      { value: "preterite", label: "Preterite (Pretérito)" },
      { value: "imperfect", label: "Imperfect (Imperfecto)" },
      { value: "future", label: "Future (Futuro)" },
      { value: "conditional", label: "Conditional (Condicional)" },
      { value: "present_perfect", label: "Present Perfect (Pretérito Perfecto)" },
    ],
    fr: [
      { value: "neutral", label: "Natural" },
      { value: "present", label: "Present (Présent)" },
      { value: "past", label: "Past (Passé Composé)" },
      { value: "imperfect", label: "Imperfect (Imparfait)" },
      { value: "future", label: "Future (Futur)" },
      { value: "conditional", label: "Conditional (Conditionnel)" },
    ],
    de: [
      { value: "neutral", label: "Natural" },
      { value: "present", label: "Present (Präsens)" },
      { value: "past", label: "Past (Perfekt)" },
      { value: "imperfect", label: "Imperfect (Präteritum)" },
      { value: "future", label: "Future (Futur)" },
    ],
    // Default tenses for other languages
    default: [
      { value: "neutral", label: "Natural Tense" },
      { value: "present", label: "Present Tense" },
      { value: "past", label: "Past Tense" },
      { value: "future", label: "Future Tense" },
    ],
  };

  // Get tense options based on selected language
  const getTenseOptions = (lang: string) => {
    return languageTenses[lang as keyof typeof languageTenses] || languageTenses.default;
  };

  const tenseOptions = getTenseOptions(targetLanguage);

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

    if (!navigator.onLine) {
      showNotification({
        message: "No internet connection. Please check your network and try again.",
        type: "error",
      });
      return;
    }

    setIsTranslating(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

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
        credentials: 'include',
        signal: controller.signal
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
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          showNotification({
            message: "Request timed out. Please try again.",
            type: "error",
          });
        } else if (error.message.includes('Failed to fetch')) {
          showNotification({
            message: "Network error. Please check your connection and try again.",
            type: "error",
          });
        } else {
          showNotification({
            message: error.message,
            type: "error",
          });
        }
      } else {
        showNotification({
          message: "An unexpected error occurred. Please try again.",
          type: "error",
        });
      }
    } finally {
      clearTimeout(timeoutId);
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
                <Select 
                  value={selectedTense} 
                  onValueChange={(value) => {
                    setSelectedTense(value);
                    // Reset tense to neutral when changing languages if the current tense
                    // isn't available in the new language
                    const newTenseOptions = getTenseOptions(targetLanguage);
                    if (!newTenseOptions.some(t => t.value === value)) {
                      setSelectedTense('neutral');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <div className="px-3 py-2">
                        <input
                          className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Search tenses..."
                          onChange={(e) => {
                            try {
                              const searchTerm = e.target.value.toLowerCase();
                              const filteredTenses = getTenseOptions(targetLanguage)
                                .filter(tense => 
                                  tense.label.toLowerCase().includes(searchTerm)
                                );
                              // Get the select content element
                              const selectContent = e.currentTarget.closest('.SelectContent');
                              if (!selectContent) return;
                              
                              // Update the visible options
                              const options = selectContent.querySelectorAll('[role="option"]');
                              options.forEach(option => {
                                const value = option.getAttribute('data-value');
                                const shouldShow = filteredTenses.some(t => t.value === value);
                                if (option instanceof HTMLElement) {
                                  option.style.display = shouldShow ? '' : 'none';
                                }
                              });
                            } catch (error) {
                              console.error('Error filtering tenses:', error);
                            }
                          }}
                        />
                      </div>
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
