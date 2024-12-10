import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/contexts/SettingsContext";
import { useState } from "react";
import { BookOpen } from "lucide-react";

export default function QuizCreator() {
  const { theme } = useSettings();
  const [quizTopic, setQuizTopic] = useState("");
  const [quizDifficulty, setQuizDifficulty] = useState("medium");

  return (
    <div className={`container mx-auto px-4 py-8 ${theme === 'dark' ? 'dark' : ''}`}>
      <h1 className="text-3xl font-bold mb-8">Practice Quiz Creator</h1>
      <Card className="p-6">
        <div className="space-y-4">
          <Input
            placeholder="Enter quiz topic..."
            value={quizTopic}
            onChange={(e) => setQuizTopic(e.target.value)}
          />
          <select
            value={quizDifficulty}
            onChange={(e) => setQuizDifficulty(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <Button
            disabled={!quizTopic.trim()}
            className="w-full"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Generate Quiz
          </Button>
        </div>
      </Card>
    </div>
  );
}
