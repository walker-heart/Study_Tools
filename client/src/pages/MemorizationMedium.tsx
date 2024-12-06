import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MemorizationMedium() {
  const [text, setText] = useState('');
  const [currentInput, setCurrentInput] = useState('');
  const [showGame, setShowGame] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  // Set up the game when text is entered and game starts
  const startGame = () => {
    if (!text.trim()) return;
    setCurrentInput('');
    setShowGame(true);
  };

  // Update the display with color-coded feedback
  const updateDisplay = () => {
    if (!displayRef.current) return;
    
    let displayText = '';
    let inputIndex = 0;
    let hasError = false;  // Track if we've encountered an error
    
    // Process each character in the text
    for (let i = 0; i < text.length; i++) {
      if (inputIndex < currentInput.length) {
        // Handle typed characters
        const typedChar = currentInput[inputIndex];
        
        // Check if this character is correct (only if no previous errors)
        const isCorrect = !hasError && typedChar === text[i];
        
        // If this character is wrong, mark all future characters as wrong
        if (typedChar !== text[i]) {
          hasError = true;
        }
        
        displayText += `<span style="color: ${isCorrect ? 'green' : 'red'}">${typedChar}</span>`;
        inputIndex++;
      } else if (inputIndex === currentInput.length) {
        // Show caret at current position
        displayText += '<span class="blink">|</span>';
        // Add underscore for non-space characters
        displayText += text[i] === ' ' ? ' ' : '_';
        inputIndex++;
      } else {
        // Show remaining characters as underscores or spaces
        displayText += text[i] === ' ' ? ' ' : '_';
      }
    }
    
    // Handle any extra typed characters beyond the text length
    while (inputIndex < currentInput.length) {
      displayText += `<span style="color: red">${currentInput[inputIndex]}</span>`;
      inputIndex++;
    }
    
    // If at the end of input, show the caret
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
  }, [currentInput, showGame]);

  // Focus input when game starts
  useEffect(() => {
    if (showGame) {
      inputRef.current?.focus();
    }
  }, [showGame]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-center mb-8">
        Study Tools
      </h1>
      <h2 className="text-xl font-semibold text-center mb-4">
        Mode: Medium
      </h2>

      {!showGame ? (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Enter the text you want to memorize:
              </p>
            </div>

            <textarea
              className="w-full min-h-[200px] p-4 border rounded-lg"
              placeholder="Enter the text here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            <Button 
              onClick={startGame}
              className="w-full"
            >
              Start Medium Mode
            </Button>
          </div>
        </Card>
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
            onClick={() => setShowGame(false)}
            className="w-32"
          >
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
