import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MemorizationEasy() {
  // Get text from URL parameters
  const searchParams = new URLSearchParams(window.location.search);
  const textParam = searchParams.get('text');
  const decodedText = textParam ? decodeURIComponent(textParam) : '';
  
  // State
  const [text] = useState<string>(decodedText);
  const [currentInput, setCurrentInput] = useState<string>('');
  const [showGame, setShowGame] = useState<boolean>(true);
  const [, setLocation] = useLocation();
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  // Update the display with color-coded feedback
  const updateDisplay = () => {
    if (!displayRef.current) return;
    
    let displayText = '';
    let inputIndex = 0;
    let hasError = false;
    
    for (let i = 0; i < text.length; i++) {
      if (inputIndex < currentInput.length) {
        const typedChar = currentInput[inputIndex];
        const isCorrect = !hasError && typedChar === text[i];
        
        if (typedChar !== text[i]) {
          hasError = true;
        }
        
        displayText += `<span style="color: ${isCorrect ? 'green' : 'red'}">${typedChar}</span>`;
        inputIndex++;
      } else if (inputIndex === currentInput.length) {
        displayText += '<span class="blink">|</span>';
        displayText += text[i] === ' ' ? ' ' : '_';
        inputIndex++;
      } else {
        displayText += text[i] === ' ' ? ' ' : '_';
      }
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

  // Redirect if no text is provided
  useEffect(() => {
    if (!text.trim()) {
      setLocation('/memorization');
    }
  }, [text, setLocation]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-center mb-8">
        Study Tools
      </h1>
      <h2 className="text-xl font-semibold text-center mb-4">
        Mode: Easy
      </h2>

      {!showGame ? (
        <div className="text-center">
          <p>Loading...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Card 
            className="p-6 min-h-[400px] cursor-text relative" 
            onClick={() => inputRef.current?.focus()}
          >
            <div 
              ref={displayRef} 
              className="typing-area mb-4 min-h-[300px] whitespace-pre-wrap text-xl"
              style={{ fontFamily: 'monospace' }}
            />
            <input
              ref={inputRef}
              type="text"
              className="opacity-0 absolute"
              value={currentInput}
              onChange={handleTyping}
              autoFocus
            />
          </Card>
          <Button 
            onClick={() => setLocation('/memorization')}
            className="w-32"
          >
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
