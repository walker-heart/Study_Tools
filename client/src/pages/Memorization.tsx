import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Memorization() {
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
    
    const words = text.split(' ');
    const inputWords = currentInput.split(' ');
    const currentWordIndex = inputWords.length - 1;
    
    const displayText = words.map((word, index) => {
      if (index < currentWordIndex) {
        // Previously typed words
        const typedWord = inputWords[index];
        return typedWord === word ? 
          `<span style="color: green">${word}</span>` : 
          `<span style="color: red">${typedWord}</span>`;
      }
      
      if (index === currentWordIndex) {
        // Current word being typed
        const typedPart = inputWords[index] || '';
        let displayWord = '';
        
        // Create base word with underscores
        const baseLength = word.length;
        
        for (let i = 0; i < baseLength; i++) {
          if (i < typedPart.length) {
            // Show typed character (correct in green, incorrect in red)
            const isCorrect = typedPart[i] === word[i];
            displayWord += `<span style="color: ${isCorrect ? 'green' : 'red'}">${typedPart[i]}</span>`;
          } else if (i === typedPart.length) {
            // Show caret at current typing position
            displayWord += '<span class="blink">|</span>_';
          } else {
            // Show remaining underscores
            displayWord += '_';
          }
        }
        
        // If typed more characters than word length, append them in red
        if (typedPart.length > word.length) {
          displayWord += `<span style="color: red">${typedPart.slice(word.length)}</span>`;
        } else if (typedPart.length === word.length) {
          // Add caret at the end if we've typed exactly to the end
          displayWord += '<span class="blink">|</span>';
        }
        return displayWord;
      }
      
      // Future words - show as underscores
      return '_'.repeat(word.length);
    }).join(' ');

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
        Mode: Easy
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
              Start Easy Mode
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