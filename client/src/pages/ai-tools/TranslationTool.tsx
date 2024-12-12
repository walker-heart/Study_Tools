import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

export default function TranslationTool() {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [selectedTense, setSelectedTense] = useState("neutral");
  const [isTranslating, setIsTranslating] = useState(false);
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [customPrompt, setCustomPrompt] = useState("");

  // Define tenses for each language
  const languageTenses = {
    en: [
      { value: "neutral", label: "Natural" },
      { value: "present", label: "Present Simple" },
      { value: "present_continuous", label: "Present Continuous" },
      { value: "present_perfect", label: "Present Perfect" },
      { value: "present_perfect_continuous", label: "Present Perfect Continuous" },
      { value: "past", label: "Past Simple" },
      { value: "past_continuous", label: "Past Continuous" },
      { value: "past_perfect", label: "Past Perfect" },
      { value: "past_perfect_continuous", label: "Past Perfect Continuous" },
      { value: "future", label: "Future Simple" },
      { value: "future_continuous", label: "Future Continuous" },
      { value: "future_perfect", label: "Future Perfect" },
      { value: "future_perfect_continuous", label: "Future Perfect Continuous" }
    ],
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
  const getTenseOptions = (lang: string) => {
    return languageTenses[lang as keyof typeof languageTenses] || languageTenses.default;
  };

  const tenseOptions = getTenseOptions(targetLanguage);

  const languages = [
    { code: "en", name: "English" },
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
          customPrompt: customPrompt.trim(),
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message || 
          `Server error: ${response.status} ${response.statusText}`
        );
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
      let errorMessage: string;
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String((error as { message: unknown }).message);
      } else {
        errorMessage = "Failed to translate text. Please try again.";
      }

      showNotification({
        message: errorMessage,
        type: "error",
      });

      // If it's an authentication error, redirect to API settings
      if (response.status === 401) {
        navigate("/settings/api");
      }
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

            <div>
              <label className="block text-sm font-medium mb-2">
                Additional Instructions (Optional)
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  e.g., "Make it more formal" or "Use simple vocabulary"
                </span>
              </label>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Add any specific instructions for the translation..."
                className="min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Target Language</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {targetLanguage
                        ? languages.find((lang) => lang.code === targetLanguage)?.name
                        : "Select language..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search languages..." />
                      <CommandEmpty>No language found.</CommandEmpty>
                      <CommandGroup className="max-h-[200px] overflow-auto">
                        {languages.map((lang) => (
                          <CommandItem
                            key={lang.code}
                            value={`${lang.code} ${lang.name}`}
                            onSelect={(currentValue) => {
                              setTargetLanguage(lang.code);
                              setSelectedTense('neutral');
                              (document.querySelector('[role="combobox"]') as HTMLButtonElement)?.click();
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                targetLanguage === lang.code ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {lang.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Translation Tense</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedTense
                        ? tenseOptions.find((tense) => tense.value === selectedTense)?.label
                        : "Select tense..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Search tenses..." />
                      <CommandEmpty>No tense found.</CommandEmpty>
                      <CommandGroup className="max-h-[200px] overflow-auto">
                        {tenseOptions.map((tense) => (
                          <CommandItem
                            key={tense.value}
                            value={tense.value}
                            onSelect={(currentValue) => {
                              setSelectedTense(currentValue);
                              (document.querySelector('[role="combobox"]') as HTMLButtonElement)?.click();
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedTense === tense.value ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {tense.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
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
