import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/contexts/SettingsContext";
import { useNotification } from "@/components/ui/notification";
import { Image, Mic, BookOpen } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";

export default function AITools() {
  const { theme } = useSettings();
  const { showNotification } = useNotification();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [textToRead, setTextToRead] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [quizTopic, setQuizTopic] = useState("");
  const [quizDifficulty, setQuizDifficulty] = useState("medium");

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageToText = async () => {
    if (!selectedImage) {
      showNotification({
        message: "Please select an image first",
        type: "error"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const response = await fetch('/api/ai/image-to-text', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to process image');
      }

      const result = await response.json();
      showNotification({
        message: "Image processed successfully",
        type: "success"
      });
      // Handle the extracted text result
    } catch (error) {
      showNotification({
        message: "Failed to process image",
        type: "error"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextToSpeech = async () => {
    if (!textToRead.trim()) {
      showNotification({
        message: "Please enter some text to read",
        type: "error"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/ai/text-to-speech', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: textToRead })
      });

      if (!response.ok) {
        throw new Error('Failed to convert text to speech');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();

      showNotification({
        message: "Text converted to speech successfully",
        type: "success"
      });
    } catch (error) {
      showNotification({
        message: "Failed to convert text to speech",
        type: "error"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateQuiz = async () => {
    if (!quizTopic.trim()) {
      showNotification({
        message: "Please enter a quiz topic",
        type: "error"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/ai/create-quiz', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          topic: quizTopic,
          difficulty: quizDifficulty
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create quiz');
      }

      const result = await response.json();
      showNotification({
        message: "Quiz created successfully",
        type: "success"
      });
      // Handle the created quiz result
    } catch (error) {
      showNotification({
        message: "Failed to create quiz",
        type: "error"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`container mx-auto px-4 py-8 ${theme === 'dark' ? 'dark' : ''}`}>
      <h1 className="text-3xl font-bold mb-8">AI Tools</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Image to Text Tool */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              Image to Text
            </CardTitle>
            <CardDescription>Extract text from images using AI</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-4">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full"
                />
                {imagePreview && (
                  <AspectRatio ratio={16 / 9} className="mt-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="rounded-lg object-cover w-full h-full"
                    />
                  </AspectRatio>
                )}
              </div>
              <Button
                onClick={handleImageToText}
                disabled={!selectedImage || isProcessing}
                className="w-full"
              >
                {isProcessing ? "Processing..." : "Extract Text"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Text to Speech Tool */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Text to Speech
            </CardTitle>
            <CardDescription>Convert text to natural speech</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                placeholder="Enter text to convert to speech..."
                value={textToRead}
                onChange={(e) => setTextToRead(e.target.value)}
                className="min-h-[100px]"
              />
              <Button
                onClick={handleTextToSpeech}
                disabled={!textToRead.trim() || isProcessing}
                className="w-full"
              >
                {isProcessing ? "Converting..." : "Convert to Speech"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Practice Quiz Creator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Practice Quiz Creator
            </CardTitle>
            <CardDescription>Generate quizzes with AI</CardDescription>
          </CardHeader>
          <CardContent>
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
                onClick={handleCreateQuiz}
                disabled={!quizTopic.trim() || isProcessing}
                className="w-full"
              >
                {isProcessing ? "Creating..." : "Generate Quiz"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
