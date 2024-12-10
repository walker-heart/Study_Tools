import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/contexts/SettingsContext";
import { useState } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { useNotification } from "@/components/ui/notification";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

export function ImageToText() {
  const { theme } = useSettings();
  const { showNotification } = useNotification();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      showNotification({
        message: "Image size should be less than 5MB",
        type: "error"
      });
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
      setAnalysisResult(null); // Clear previous results
    };
    reader.onerror = () => {
      showNotification({
        message: "Error reading image file",
        type: "error"
      });
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (mode: 'extract' | 'summarize') => {
    if (!imagePreview) {
      showNotification({
        message: "Please select an image first",
        type: "error"
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const response = await fetch('/api/user/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imagePreview,
          mode,
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.details || 'Failed to analyze image');
      }

      const data = await response.json();
      setAnalysisResult(data.description);
      showNotification({
        message: "Image analyzed successfully",
        type: "success"
      });
    } catch (error) {
      console.error('Error analyzing image:', error);
      showNotification({
        message: error instanceof Error ? error.message : 'Failed to analyze image',
        type: "error"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className={`container mx-auto px-4 py-8 ${theme === 'dark' ? 'dark' : ''}`}>
      <h1 className="text-3xl font-bold mb-8">Image to Text</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side - Image Upload */}
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Upload Image</h2>
            <div className="border-2 border-dashed rounded-lg p-4">
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full"
                disabled={isAnalyzing}
              />
              {imagePreview && (
                <AspectRatio ratio={16 / 9} className="mt-4">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="rounded-lg object-contain w-full h-full"
                  />
                </AspectRatio>
              )}
            </div>
            <div className="flex gap-4">
              <Button
                onClick={() => analyzeImage('extract')}
                disabled={!selectedImage || isAnalyzing}
                className="flex-1"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4 mr-2" />
                )}
                {isAnalyzing ? "Analyzing..." : "Extract Text"}
              </Button>
              <Button
                onClick={() => analyzeImage('summarize')}
                disabled={!selectedImage || isAnalyzing}
                className="flex-1"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4 mr-2" />
                )}
                {isAnalyzing ? "Analyzing..." : "Summarize"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Right side - Analysis Results */}
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Analysis Results</h2>
            <div className="min-h-[300px] bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
              {analysisResult ? (
                <div className="prose dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{analysisResult}</p>
                </div>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 h-full flex items-center justify-center">
                  <p>Upload an image and click analyze to see the results here</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
