import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-center mb-8">
        Study Tools Hub
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Flashcard Generator</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Create printable vocabulary flashcards from CSV data with automatic numbering and formatting.
              </p>
              <Link href="/flashcards">
                <Button className="w-full">
                  Open Flashcard Generator
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Memorization Tool</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Practice and memorize text with different difficulty levels and testing modes.
              </p>
              <Link href="/memorization">
                <Button className="w-full">
                  Open Memorization Tool
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">AI Tools</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Access powerful AI features including image-to-text, text-to-speech, and quiz generation.
              </p>
              <Link href="/ai-tools">
                <Button className="w-full">
                  Open AI Tools
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
