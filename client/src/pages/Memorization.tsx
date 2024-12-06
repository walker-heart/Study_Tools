import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import "@/styles/memorization.css";

export default function Memorization() {
  const [text, setText] = useState('');
  const [, setLocation] = useLocation();

  const startMode = (mode: 'easy' | 'medium') => {
    if (!text.trim()) return;
    setLocation(`/memorization-${mode}?text=${encodeURIComponent(text)}`);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="heading-primary">
        Study Tools
      </h1>

      <Card className="card-container">
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-lg text-gray-700">
              Enter the text you want to memorize:
            </p>
          </div>

          <textarea
            className="text-input"
            placeholder="Enter the text here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              className="mode-button"
              disabled={!text.trim()}
              onClick={() => startMode('easy')}
              variant="secondary"
            >
              Start Easy Mode
            </Button>
            
            <Button 
              className="mode-button"
              disabled={!text.trim()}
              onClick={() => startMode('medium')}
              variant="secondary"
            >
              Start Medium Mode
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
