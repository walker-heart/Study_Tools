import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type GameMode = 'easy' | 'medium' | 'hard' | 'test';

interface GameStats {
  startTime: number;
  wordsTyped: number;
  errors: number;
  totalWords: number;
}

export default function Memorization() {
  const [mode, setMode] = useState<GameMode | ''>('');
  const [showGame, setShowGame] = useState(false);
  const [text, setText] = useState('');
  const [currentText, setCurrentText] = useState('');
  const [words, setWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [gameStats, setGameStats] = useState<GameStats>({
    startTime: 0,
    wordsTyped: 0,
    errors: 0,
    totalWords: 0
  });
  
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const typingAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showGame) {
      focusInput();
      const wordsArray = text.trim().split(/\s+/).filter(word => word.length > 0);
      setWords(wordsArray);
      setGameStats({
        startTime: Date.now(),
        wordsTyped: 0,
        errors: 0,
        totalWords: wordsArray.length
      });
      updateDisplay();
    }
  }, [showGame, mode]);

  const getWordDisplay = (word: string, index: number, mode: GameMode) => {
    if (index < currentWordIndex) {
      // Already typed words
      return `<span style="color: gray">${word}</span>`;
    } 
    
    if (index === currentWordIndex) {
      // Current word
      if (currentText.length === 0) {
        // Show initial state with cursor
        let display = '<span class="blink">|</span>';
        if (mode === 'easy') {
          // In easy mode, show the word faded
          display += `<span style="color: #666">${word}</span>`;
        } else {
          // In other modes, show underscores
          display += '_'.repeat(word.length);
        }
        return display;
      }

      // Handling typed text
      let displayWord = '';
      for (let i = 0; i < Math.max(word.length, currentText.length); i++) {
        if (i < currentText.length) {
          const isCorrect = currentText[i] === word[i];
          const char = word[i] || '';
          displayWord += `<span style="color: ${isCorrect ? 'green' : 'red'}">${char}</span>`;
        } else if (mode === 'easy' || mode === 'medium') {
          displayWord += word[i]; // Show remaining letters in easy/medium mode
        } else {
          displayWord += '_'; // Show underscores in hard/test mode
        }
      }
      return displayWord + '<span class="blink">|</span>';
    }

    // Future words
    switch (mode) {
      case 'easy':
        return `<span style="color: #666">${word}</span>`; // Show full word faded
      case 'medium':
        return word[0] + '_'.repeat(word.length - 1); // Show first letter
      case 'hard':
      case 'test':
        return '_'.repeat(word.length); // Show only underscores
    }
  };

  const updateDisplay = () => {
    if (!typingAreaRef.current || !mode) return;

    const displayText = words.map((word, index) => 
      getWordDisplay(word, index, mode)
    ).join(' ');
    
    typingAreaRef.current.innerHTML = displayText;
  };

  const handleTyping = () => {
    if (!hiddenInputRef.current || !mode) return;

    const inputValue = hiddenInputRef.current.value;
    const currentWord = words[currentWordIndex];
    
    setCurrentText(inputValue);

    // Check for word completion
    if (inputValue === currentWord) {
      hiddenInputRef.current.value = '';
      setCurrentText('');
      setCurrentWordIndex(prev => {
        const next = prev + 1;
        if (next >= words.length && mode === 'test') {
          // End game in test mode
          const endTime = Date.now();
          const timeElapsed = (endTime - gameStats.startTime) / 1000;
          alert(`Test completed!\nTime: ${timeElapsed.toFixed(2)}s\nWords: ${words.length}\nWPM: ${((words.length / timeElapsed) * 60).toFixed(2)}`);
          setShowGame(false);
          return prev;
        }
        return next % words.length;
      });
      setGameStats(prev => ({
        ...prev,
        wordsTyped: prev.wordsTyped + 1
      }));
    } else if (inputValue.length > currentWord.length) {
      // Count as an error if typed more than word length
      setGameStats(prev => ({
        ...prev,
        errors: prev.errors + 1
      }));
      hiddenInputRef.current.value = inputValue.slice(0, currentWord.length);
    }

    updateDisplay();
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
              <Button 
                onClick={() => startGame('easy')}
                className="bg-green-500 hover:bg-green-600"
              >
                Easy
              </Button>
              <Button 
                onClick={() => startGame('medium')}
                className="bg-yellow-500 hover:bg-yellow-600"
              >
                Medium
              </Button>
              <Button 
                onClick={() => startGame('hard')}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Hard
              </Button>
              <Button 
                onClick={() => startGame('test')}
                className="bg-red-500 hover:bg-red-600"
              >
                Test
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card 
            className="p-6 min-h-[400px] cursor-text relative" 
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
            {mode === 'test' && (
              <div className="absolute top-4 right-4 text-sm">
                Words: {gameStats.wordsTyped}/{gameStats.totalWords}
              </div>
            )}
          </Card>
          <div className="flex justify-between items-center">
            <Button 
              onClick={() => setShowGame(false)}
              className="w-32"
            >
              Back
            </Button>
            {mode === 'test' && (
              <div className="text-sm">
                Errors: {gameStats.errors}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
