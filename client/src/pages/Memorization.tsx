import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/SettingsContext";
import "@/styles/memorization.css";

export default function Memorization() {
  const [text, setText] = useState('');
  const [, setLocation] = useLocation();
  const { theme } = useSettings();

  const startMode = (mode: 'easy' | 'medium') => {
    if (!text.trim()) return;
    setLocation(`/memorization-${mode}?text=${encodeURIComponent(text)}`);
  };

  return (
    <div className={`container mx-auto px-4 py-8 max-w-4xl ${theme === 'dark' ? 'dark bg-gray-900' : ''}`}>
      <h1 className={`heading-primary ${theme === 'dark' ? 'text-white' : ''}`}>
        Study Tools
      </h1>

      <Card className="card-container bg-white">
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-lg text-gray-700">
              Enter the text you want to memorize:
            </p>
          </div>

          <textarea
            className="w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
            placeholder="Enter the text here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
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
