import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import FileUpload from "../components/FileUpload";
import { generatePDF } from "../lib/pdfGenerator";

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleFileProcess = async (file: File) => {
    setIsProcessing(true);
    try {
      await generatePDF(file);
      toast({
        title: "Success",
        description: "PDF generated successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate PDF",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-center mb-8">
        Vocabulary Flashcard Generator
      </h1>
      
      <Card className="p-6">
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Upload CSV File</h2>
            <p className="text-sm text-gray-600">
              Upload a CSV file containing vocabulary words, parts of speech, definitions, and example sentences.
            </p>
          </div>

          <FileUpload 
            onFileSelect={handleFileProcess}
            isProcessing={isProcessing}
          />

          <div className="text-sm text-gray-600 mt-4">
            <h3 className="font-medium mb-2">Required CSV columns:</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Vocab Word</li>
              <li>Identifying Part Of Speech</li>
              <li>Definition</li>
              <li>Example Sentence</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
