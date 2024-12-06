import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Memorization() {
  const [mode, setMode] = useState<string>("");
  const [showGame, setShowGame] = useState(false);
  const [text, setText] = useState("");
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const typingAreaRef = useRef<HTMLDivElement>(null);

  const handleTyping = () => {
    if (hiddenInputRef.current && typingAreaRef.current) {
      // Implementation will go here
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    // Implementation will go here
  };

  const startGame = (selectedMode: string) => {
    setMode(selectedMode);
    setShowGame(true);
  };

  const focusInput = () => {
    hiddenInputRef.current?.focus();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-center mb-8">
        Memorization Tool
      </h1>

      {!showGame ? (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Enter Text to Memorize</h2>
              <p className="text-sm text-gray-600">
                Enter the text you want to memorize below and select a difficulty level.
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
            className="typing-area mb-4 min-h-[300px]"
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
