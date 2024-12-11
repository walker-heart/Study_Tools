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

interface TenseOption {
  value: string;
  label: string;
}

export default function TranslationTool() {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [selectedTense, setSelectedTense] = useState("neutral");
  const [isTranslating, setIsTranslating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [customization, setCustomization] = useState("");
  const [, setLocation] = useLocation();
  const { showNotification } = useNotification();

  // Define tenses for each language
  const languageTenses: Record<string, TenseOption[]> = {
    es: [
      { value: "neutral", label: "Natural" },
      { value: "present", label: "Present (Presente)" },
      { value: "preterite", label: "Preterite (Pretérito Indefinido)" },
      { value: "imperfect", label: "Imperfect (Imperfecto)" },
      { value: "future", label: "Future (Futuro Simple)" },
      { value: "conditional", label: "Conditional (Condicional Simple)" },
      { value: "present_perfect", label: "Present Perfect (Pretérito Perfecto)" },
      { value: "past_perfect", label: "Past Perfect (Pretérito Pluscuamperfecto)" },
      { value: "future_perfect", label: "Future Perfect (Futuro Perfecto)" },
      { value: "conditional_perfect", label: "Conditional Perfect (Condicional Perfecto)" },
      { value: "present_subjunctive", label: "Present Subjunctive (Presente Subjuntivo)" },
      { value: "past_subjunctive", label: "Past Subjunctive (Pretérito Imperfecto Subjuntivo)" },
      { value: "future_subjunctive", label: "Future Subjunctive (Futuro Subjuntivo)" }
    ],
    fr: [
      { value: "neutral", label: "Natural" },
      { value: "present", label: "Present (Présent)" },
      { value: "passe_compose", label: "Present Perfect (Passé Composé)" },
      { value: "imperfect", label: "Imperfect (Imparfait)" },
      { value: "passe_simple", label: "Simple Past (Passé Simple)" },
      { value: "future", label: "Future (Futur Simple)" },
      { value: "past_perfect", label: "Past Perfect (Plus-que-parfait)" },
      { value: "future_perfect", label: "Future Perfect (Futur Antérieur)" },
      { value: "conditional_perfect", label: "Conditional Perfect (Conditionnel Passé)" },
      { value: "present_subjunctive", label: "Present Subjunctive (Subjonctif Présent)" },
      { value: "past_subjunctive", label: "Past Subjunctive (Subjonctif Passé)" }
    ],
    de: [
      { value: "neutral", label: "Natural" },
      { value: "present", label: "Present (Präsens)" },
      { value: "preterite", label: "Simple Past (Präteritum)" },
      { value: "perfect", label: "Present Perfect (Perfekt)" },
      { value: "past_perfect", label: "Past Perfect (Plusquamperfekt)" },
      { value: "future", label: "Future (Futur I)" },
      { value: "future_perfect", label: "Future Perfect (Futur II)" },
      { value: "present_subjunctive", label: "Present Subjunctive (Konjunktiv I)" },
      { value: "past_subjunctive", label: "Past Subjunctive (Konjunktiv II)" }
    ],
    it: [
      { value: "neutral", label: "Natural" },
      { value: "present", label: "Present (Presente)" },
      { value: "present_perfect", label: "Present Perfect (Passato Prossimo)" },
      { value: "imperfect", label: "Imperfect (Imperfetto)" },
      { value: "past_historic", label: "Simple Past (Passato Remoto)" },
      { value: "future", label: "Future (Futuro Semplice)" },
      { value: "past_perfect", label: "Past Perfect (Trapassato Prossimo)" },
      { value: "future_perfect", label: "Future Perfect (Futuro Anteriore)" },
      { value: "conditional_perfect", label: "Conditional Perfect (Condizionale Passato)" },
      { value: "present_subjunctive", label: "Present Subjunctive (Congiuntivo Presente)" },
      { value: "past_subjunctive", label: "Past Subjunctive (Congiuntivo Imperfetto)" }
    ],
    pt: [
      { value: "neutral", label: "Natural" },
      { value: "present", label: "Present (Presente)" },
      { value: "preterite", label: "Preterite (Pretérito Perfeito)" },
      { value: "imperfect", label: "Imperfect (Pretérito Imperfeito)" },
      { value: "future", label: "Future (Futuro do Presente)" },
      { value: "conditional", label: "Conditional (Condicional Simples)" },
      { value: "past_perfect", label: "Past Perfect (Pretérito Mais-que-perfeito)" },
      { value: "future_conditional", label: "Future Conditional (Futuro do Pretérito)" },
      { value: "present_subjunctive", label: "Present Subjunctive (Presente do Subjuntivo)" },
      { value: "past_subjunctive", label: "Past Subjunctive (Pretérito Imperfeito do Subjuntivo)" },
      { value: "future_subjunctive", label: "Future Subjunctive (Futuro do Subjuntivo)" }
    ],
    nl: [
      { value: "neutral", label: "Natural" },
      { value: "present", label: "Present (Tegenwoordige Tijd)" },
      { value: "past", label: "Past (Verleden Tijd)" },
      { value: "perfect", label: "Perfect (Voltooide Tijd)" },
      { value: "past_perfect", label: "Past Perfect (Plusquamperfectum)" },
      { value: "future", label: "Future (Toekomende Tijd)" }
    ],
    ru: [
      { value: "neutral", label: "Natural" },
      { value: "present", label: "Present Tense" },
      { value: "past", label: "Past Tense" },
      { value: "future", label: "Future Tense" },
      { value: "perfective", label: "Perfective Aspect" },
      { value: "imperfective", label: "Imperfective Aspect" }
    ],
    ja: [
      { value: "neutral", label: "Natural" },
      { value: "non_past", label: "Non-Past (Present/Future)" },
      { value: "past", label: "Past" },
      { value: "conditional", label: "Conditional" },
      { value: "volitional", label: "Volitional" },
      { value: "imperative", label: "Imperative" }
    ],
    ko: [
      { value: "neutral", label: "Natural" },
      { value: "present", label: "Present" },
      { value: "past", label: "Past" },
      { value: "future", label: "Future" },
      { value: "conditional", label: "Conditional" },
      { value: "honorific", label: "Honorific" }
    ],
    zh: [
      { value: "neutral", label: "Natural" },
      { value: "default", label: "Default (No Formal Tenses)" },
      { value: "le", label: "Aspect: 了 (le)" },
      { value: "guo", label: "Aspect: 过 (guo)" },
      { value: "zhe", label: "Aspect: 着 (zhe)" }
    ],
    // Default tenses for other languages
    default: [
      { value: "neutral", label: "Natural Tense" },
      { value: "present", label: "Present Tense" },
      { value: "past", label: "Past Tense" },
      { value: "future", label: "Future Tense" }
    ],
  };

  // Get tense options based on selected language
  const getTenseOptions = (lang: string): TenseOption[] => {
    return languageTenses[lang as keyof typeof languageTenses] || languageTenses.default;
  };

  const tenseOptions = getTenseOptions(targetLanguage);

  const languages = [
    { code: "es", name: "Spanish (Español)" },
    { code: "fr", name: "French (Français)" },
    { code: "de", name: "German (Deutsch)" },
    { code: "it", name: "Italian (Italiano)" },
    { code: "pt", name: "Portuguese (Português)" },
    { code: "nl", name: "Dutch (Nederlands)" },
    { code: "ru", name: "Russian (Русский)" },
    { code: "ja", name: "Japanese (日本語)" },
    { code: "ko", name: "Korean (한국어)" },
    { code: "zh", name: "Chinese (中文)" },
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
          customization: customization.trim(),
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

  // Filter tense options based on search term
  const filteredTenseOptions = tenseOptions.filter(tense => 
    searchTerm.trim() === '' || 
    tense.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tense.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                className="min-h-[200px] bg-background text-foreground placeholder:text-muted-foreground"
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
                <div className="space-y-2">
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Search tenses..."
                        value={searchTerm}
                        onChange={(e) => {
                          e.preventDefault();
                          setSearchTerm(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          // Prevent the select from capturing keyboard events
                          e.stopPropagation();
                        }}
                      />
                    </div>
                    
                    <Select 
                      value={selectedTense} 
                      onValueChange={(value) => {
                        setSelectedTense(value);
                        setSearchTerm(""); // Clear search after selection
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a tense" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {filteredTenseOptions.map((tense) => (
                            <SelectItem 
                              key={tense.value} 
                              value={tense.value}
                            >
                              {tense.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        {filteredTenseOptions.length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                            No tenses found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Custom Instructions (Optional)</label>
              <Textarea
                value={customization}
                onChange={(e) => setCustomization(e.target.value)}
                placeholder="Add any specific translation instructions or preferences..."
                className="min-h-[100px] bg-background text-foreground placeholder:text-muted-foreground"
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
                className="min-h-[200px] bg-background text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
