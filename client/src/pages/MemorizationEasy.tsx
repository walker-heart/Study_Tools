import { useState, useEffect, useRef } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MemorizationSettings from "@/components/MemorizationSettings";

export default function MemorizationEasy() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const textParam = searchParams.get('text');
  const decodedText = textParam ? decodeURIComponent(textParam) : '';
  
  // State
  const [text] = useState<string>(decodedText);
  const [currentInput, setCurrentInput] = useState<string>('');
  const [showGame, setShowGame] = useState<boolean>(true);
  
  // Redirect if no text is provided
  useEffect(() => {
    if (!text.trim()) {
      setLocation('/memorization');
    }
  }, [text, setLocation]);
  
  // Get settings from global context
  const { fontSize, fontFamily, theme } = useSettings();
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  // Update the display with color-coded feedback and show first letter of each word
  const updateDisplay = () => {
    if (!displayRef.current) return;
    
    let displayText = '';
    let inputIndex = 0;
    let isFirstLetterOfWord = true;
    let errors = new Array(currentInput.length).fill(false);
    
    // First pass: mark errors
    // Once we hit an error, all subsequent characters are errors too
    let hasError = false;
    for (let i = 0; i < currentInput.length; i++) {
      // Mark as error if:
      // 1. We've already encountered an error
      // 2. We're past the text length
      // 3. The character doesn't match exactly at this position
      if (hasError || i >= text.length || currentInput[i] !== text[i]) {
        hasError = true;
        errors[i] = true;
      }
    }
    
    for (let i = 0; i < text.length; i++) {
      // Handle spaces between words
      if (text[i] === ' ') {
        if (inputIndex < currentInput.length) {
          const isError = errors[inputIndex];
          displayText += `<span style="color: ${isError ? 'red' : 'green'}">${currentInput[inputIndex]}</span>`;
          inputIndex++;
        } else if (inputIndex === currentInput.length) {
          displayText += '<span class="blink">|</span> ';
          inputIndex++;
        } else {
          displayText += ' ';
        }
        isFirstLetterOfWord = true;
        continue;
      }
      
      // Show first letter of each word or underscore for remaining letters
      if (isFirstLetterOfWord) {
        if (inputIndex < currentInput.length) {
          const isError = errors[inputIndex];
          displayText += `<span style="color: ${isError ? 'red' : 'green'}">${currentInput[inputIndex]}</span>`;
        } else if (inputIndex === currentInput.length) {
          displayText += `<span class="blink">|</span>${text[i]}`;
        } else {
          displayText += text[i];
        }
      } else {
        if (inputIndex < currentInput.length) {
          const isError = errors[inputIndex];
          displayText += `<span style="color: ${isError ? 'red' : 'green'}">${currentInput[inputIndex]}</span>`;
        } else if (inputIndex === currentInput.length) {
          displayText += '<span class="blink">|</span>_';
        } else {
          displayText += '_';
        }
      }
      
      if (inputIndex < currentInput.length || inputIndex === currentInput.length) {
        inputIndex++;
      }
      isFirstLetterOfWord = false;
    }
    
    while (inputIndex < currentInput.length) {
      displayText += `<span style="color: red">${currentInput[inputIndex]}</span>`;
      inputIndex++;
    }
    
    if (inputIndex === currentInput.length) {
      displayText += '<span class="blink">|</span>';
    }

    displayRef.current.innerHTML = displayText;
  };

  // Handle typing input
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentInput(e.target.value);
  };

  // Update display whenever input changes
  useEffect(() => {
    if (showGame) {
      updateDisplay();
    }
  }, [currentInput, showGame, text]);

  // Focus input when game starts
  useEffect(() => {
    if (showGame) {
      inputRef.current?.focus();
    }
  }, [showGame]);

  return (
    <div className={`container mx-auto px-4 py-8 max-w-4xl ${theme === 'dark' ? 'dark bg-gray-900 text-white' : ''}`}>
      <h1 className="text-3xl font-bold text-center mb-8">
        Study Tools
      </h1>
      <h2 className="text-xl font-semibold text-center mb-4">
        Mode: Easy
      </h2>

      <MemorizationSettings />

      {!showGame ? (
        <div className={`text-center ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          <p>Loading...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Card 
            className={`p-6 min-h-[400px] cursor-text relative ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'}`}
            onClick={() => inputRef.current?.focus()}
          >
            <div 
              ref={displayRef} 
              className="typing-area mb-4 min-h-[300px] whitespace-pre-wrap"
              style={{ 
                fontFamily: fontFamily,
                fontSize: `${fontSize}px`,
              }}
            />
            <input
              ref={inputRef}
              type="text"
              className="visually-hidden"
              value={currentInput}
              onChange={handleTyping}
              autoFocus
              aria-label="Type the text you see above"
            />
          </Card>
          <Button 
            onClick={() => setLocation('/memorization')}
            className={`w-32 ${theme === 'dark' ? 'bg-gray-100 text-gray-900 hover:bg-white' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
          >
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
