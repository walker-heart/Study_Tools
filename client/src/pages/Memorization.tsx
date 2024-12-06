import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Memorization() {
  const [mode, setMode] = useState<string>("");
  const [showGame, setShowGame] = useState(false);
  const [text, setText] = useState("");
  const [currentText, setCurrentText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const typingAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showGame) {
      focusInput();
    }
  }, [showGame]);

  const handleTyping = () => {
    if (!hiddenInputRef.current || !typingAreaRef.current) return;

    const inputValue = hiddenInputRef.current.value;
    setCurrentText(inputValue);

    // Clear input if correct
    if (inputValue === text.substring(currentIndex, currentIndex + inputValue.length)) {
      if (inputValue.length === text.length - currentIndex) {
        // Completed the text
        setShowGame(false);
        setCurrentIndex(0);
        setCurrentText("");
      }
      hiddenInputRef.current.value = "";
      setCurrentIndex(prevIndex => prevIndex + inputValue.length);
    }

    updateTypingDisplay();
  };

  const updateTypingDisplay = () => {
    if (!typingAreaRef.current) return;

    const displayText = text.split('').map((char, index) => {
      if (index < currentIndex) {
        return `<span style="color: gray">${char}</span>`;
      } else if (index < currentIndex + currentText.length) {
        const inputChar = currentText[index - currentIndex];
        const isCorrect = inputChar === char;
        return `<span style="color: ${isCorrect ? 'green' : 'red'}">${char}</span>`;
      }
      return char;
    }).join('');

    typingAreaRef.current.innerHTML = displayText;
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setShowGame(false);
      setCurrentIndex(0);
      setCurrentText("");
    }
  };

  const startGame = (selectedMode: string) => {
    if (!text.trim()) return;
    setMode(selectedMode);
    setShowGame(true);
    setCurrentIndex(0);
    setCurrentText("");
    if (typingAreaRef.current) {
      typingAreaRef.current.innerHTML = text;
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
