import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Papa from 'papaparse';
import FileUpload from "../components/FileUpload";
import { generatePDF } from "../lib/pdfGenerator";
import CardPreview from "../components/CardPreview";

interface VocabCard {
  'Vocab Word': string;
  'Identifying Part Of Speach': string;
  'Definition': string;
  'Example Sentance': string;
  lineNumber: number;
}

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewCards, setPreviewCards] = useState<VocabCard[]>([]);
  const { toast } = useToast();

  const parseCSV = (file: File): Promise<VocabCard[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          const data = results.data
            .filter((row: any) => {
              return row['Vocab Word'] && 
                row['Identifying Part Of Speach'] && 
                row['Definition'] && 
                row['Example Sentance'];
            })
            // Map starting from index 1 (after header) and subtract 1 for card numbers
            .map((row: any, index: number) => ({
              ...row,
              lineNumber: index + 2 - 1 // Add 2 for CSV row number (header is row 1), then subtract 1 as requested
            }));
          resolve(data as VocabCard[]);
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  };

  const handleFileSelect = async (file: File) => {
    try {
      const cards = await parseCSV(file);
      setPreviewCards(cards);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to parse CSV file",
        variant: "destructive",
      });
    }
  };

  const handleGeneratePDF = async () => {
    if (previewCards.length === 0) {
      toast({
        title: "Error",
        description: "Please upload a CSV file first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const csvContent = Papa.unparse(previewCards);
      const csvFile = new File([csvContent], "vocab_cards.csv", { type: "text/csv" });
      await generatePDF(csvFile);
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-center mb-8">
        Vocabulary Flashcard Generator
      </h1>
      
      <div className="space-y-8">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Upload CSV File</h2>
              <p className="text-sm text-gray-600">
                Upload a CSV file containing vocabulary words, parts of speech, definitions, and example sentences.
              </p>
            </div>

            <FileUpload 
              onFileSelect={handleFileSelect}
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

        {previewCards.length > 0 && (
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Preview Cards</h2>
                <Button 
                  onClick={handleGeneratePDF}
                  disabled={isProcessing}
                >
                  {isProcessing ? "Generating PDF..." : "Generate PDF"}
                </Button>
              </div>
              <CardPreview cards={previewCards} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
