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
      return { showFullText: true, showPartial: true, showHints: true };
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [words, setWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const typingAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showGame) {
      focusInput();
      setWords(text.split(/\s+/));
    }
  }, [showGame]);

  const handleTyping = () => {
    if (!hiddenInputRef.current || !typingAreaRef.current || !mode) return;

    const inputValue = hiddenInputRef.current.value;
    setCurrentText(inputValue);

    const displayOptions = getModeDisplay(mode as GameMode);
    const currentWord = words[currentWordIndex];
    
    if (mode === 'easy') {
      // In easy mode, check word by word
      if (inputValue === currentWord) {
        hiddenInputRef.current.value = '';
        setCurrentWordIndex(prev => {
          if (prev === words.length - 1) {
            setShowGame(false);
            return 0;
          }
          return prev + 1;
        });
      }
    } else {
      // For other modes, check the entire text
      if (inputValue === text.substring(currentIndex, currentIndex + inputValue.length)) {
        if (inputValue.length === text.length - currentIndex) {
          setShowGame(false);
          setCurrentIndex(0);
          setCurrentText('');
          setCurrentWordIndex(0);
        }
        hiddenInputRef.current.value = '';
        setCurrentIndex(prev => prev + inputValue.length);
      }
    }

    updateDisplay(displayOptions);
  };

  const updateDisplay = (displayOptions: DisplayOptions) => {
    if (!typingAreaRef.current) return;

    if (mode === 'easy') {
      // In easy mode, show underscores with first letters visible
      const displayText = words.map((word, index) => {
        if (index < currentWordIndex) {
          // Show completed words in gray
          return `<span style="color: gray">${word}</span>`;
        } else if (index === currentWordIndex) {
          // Current word being typed
          const inputText = currentText;
          let wordDisplay = '';
          for (let i = 0; i < word.length; i++) {
            if (i < inputText.length) {
              // Show typed characters in green (correct) or red (incorrect)
              const isCorrect = inputText[i] === word[i];
              wordDisplay += `<span style="color: ${isCorrect ? 'green' : 'red'}">${word[i]}</span>`;
            } else if (i === 0) {
              // Show first letter of the word
              wordDisplay += word[i];
            } else {
              // Show underscore for untyped characters
              wordDisplay += '_';
            }
          }
          return wordDisplay;
        } else {
          // Future words: show first letter and underscores
          return word[0] + '_'.repeat(word.length - 1);
        }
      }).join(' ');
      
      typingAreaRef.current.innerHTML = displayText;
    } else {
      // For other modes, show the text based on display options
      const displayText = text.split('').map((char, index) => {
        if (index < currentIndex) {
          return `<span style="color: gray">${char}</span>`;
        } else if (index < currentIndex + currentText.length) {
          const inputChar = currentText[index - currentIndex];
          const isCorrect = inputChar === char;
          return `<span style="color: ${isCorrect ? 'green' : 'red'}">${char}</span>`;
        }
        return displayOptions.showFullText ? char : 
               displayOptions.showPartial && index % 3 === 0 ? char : 
               displayOptions.showHints ? '_' : '';
      }).join('');

      typingAreaRef.current.innerHTML = displayText;
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setShowGame(false);
      setCurrentIndex(0);
      setCurrentText('');
      setCurrentWordIndex(0);
    }
  };

  const startGame = (selectedMode: GameMode) => {
    if (!text.trim()) return;
    setMode(selectedMode);
    setShowGame(true);
    setCurrentIndex(0);
    setCurrentText('');
    setCurrentWordIndex(0);
    if (typingAreaRef.current) {
      const displayOptions = getModeDisplay(selectedMode);
      updateDisplay(displayOptions);
    }
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
        <Card 
          className="p-6 min-h-[400px] cursor-text" 
          onClick={focusInput}
        >
          <div 
            ref={typingAreaRef} 
            className="typing-area mb-4 min-h-[300px] whitespace-pre-wrap"
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
      )}
    </div>
  );
}
