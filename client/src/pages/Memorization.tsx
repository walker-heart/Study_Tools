import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type GameMode = 'easy' | 'medium' | 'hard' | 'test';

interface DisplayOptions {
  showFullText: boolean;
  showPartial: boolean;
  showHints: boolean;
}

const getModeDisplay = (mode: GameMode): DisplayOptions => {
  switch (mode) {
    case 'easy':
      return { showFullText: false, showPartial: true, showHints: true };
    case 'medium':
      return { showFullText: false, showPartial: true, showHints: true };
    case 'hard':
      return { showFullText: false, showPartial: false, showHints: true };
    case 'test':
      return { showFullText: false, showPartial: false, showHints: false };
  }
};

export default function Memorization() {
  const [mode, setMode] = useState<GameMode | ''>('');
  const [showGame, setShowGame] = useState(false);
  const [text, setText] = useState('');
  const [currentText, setCurrentText] = useState('');
  const [words, setWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const typingAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showGame) {
      focusInput();
      const wordsArray = text.trim().split(/\s+/).filter(word => word.length > 0);
      setWords(wordsArray);
      updateDisplay();
    }
  }, [showGame]);

  const handleTyping = () => {
    if (!hiddenInputRef.current || !typingAreaRef.current || !mode) return;

    const inputValue = hiddenInputRef.current.value;
    setCurrentText(inputValue);

    if (mode === 'easy') {
      const currentWord = words[currentWordIndex];
      if (!currentWord) return;

      // Check if the current input matches the current word
      if (inputValue === currentWord) {
        hiddenInputRef.current.value = '';
        setCurrentText('');
        setCurrentWordIndex(prev => {
          // Just move to next word, don't end the game
          return (prev + 1) % words.length;
        });
      }
    }

    updateDisplay();
  };

  const updateDisplay = () => {
    if (!typingAreaRef.current || !mode) return;

    if (mode === 'easy') {
      const displayText = words.map((word, index) => {
        if (index < currentWordIndex) {
          // Show completed words in gray
          return `<span style="color: gray">${word}</span>`;
        } else if (index === currentWordIndex) {
          // Current word being typed
          const inputText = currentText;
          let displayWord = '';
          
          if (inputText.length === 0) {
            // Show cursor at start before typing begins
            displayWord = '<span class="blink">|</span>';
            for (let i = 0; i < word.length; i++) {
              displayWord += '_';
            }
          } else {
            // Handle typed text
            for (let i = 0; i < word.length; i++) {
              const isCorrect = inputText[i] === word[i];
              if (i < inputText.length) {
                displayWord += `<span style="color: ${isCorrect ? 'green' : 'red'}">${word[i]}</span>`;
              } else {
                displayWord += '_';
              }
            }
            displayWord += '<span class="blink">|</span>';
          }
          return displayWord;
        } else {
          // Future words: show all letters as underscores
          return '_'.repeat(word.length);
        }
      }).join(' ');
      
      typingAreaRef.current.innerHTML = displayText;
    } else {
      // Implementation for other modes...
      typingAreaRef.current.innerHTML = text;
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setShowGame(false);
      setCurrentText('');
      setCurrentWordIndex(0);
    }
  };

  const startGame = (selectedMode: GameMode) => {
    if (!text.trim()) return;
    setMode(selectedMode);
    setShowGame(true);
    setCurrentText('');
    setCurrentWordIndex(0);
  };

  const focusInput = () => {
    hiddenInputRef.current?.focus();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-center mb-8">
        Study Tools
      </h1>
      <h2 className="text-xl font-semibold text-center mb-4">
        {mode ? `Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}` : "Memorization Tool"}
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

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={() => startGame('easy')}>Easy</Button>
              <Button onClick={() => startGame('medium')}>Medium</Button>
              <Button onClick={() => startGame('hard')}>Hard</Button>
              <Button onClick={() => startGame('test')}>Test</Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card 
            className="p-6 min-h-[400px] cursor-text" 
            onClick={focusInput}
          >
            <div 
              ref={typingAreaRef} 
              className="typing-area mb-4 min-h-[300px] whitespace-pre-wrap text-xl"
              style={{ fontFamily: 'monospace' }}
            />
            <input
              ref={hiddenInputRef}
              type="text"
              className="opacity-0 absolute"
              onInput={handleTyping}
              onKeyDown={handleKeyPress}
              autoFocus
            />
          </Card>
          <div className="flex justify-center">
            <Button 
              onClick={() => setShowGame(false)}
              className="w-32"
            >
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
