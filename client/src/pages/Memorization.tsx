import { useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Memorization() {
  const [text, setText] = useState('');

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-center mb-8">
        Study Tools
      </h1>

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href={`/memorization-easy?text=${encodeURIComponent(text)}`}>
              <Button 
                className="w-full"
                disabled={!text.trim()}
              >
                Start Easy Mode
              </Button>
            </Link>
            
            <Link href={`/memorization-medium?text=${encodeURIComponent(text)}`}>
              <Button 
                className="w-full"
                disabled={!text.trim()}
              >
                Start Medium Mode
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
