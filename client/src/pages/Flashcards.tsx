import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Papa from 'papaparse';
import FileUpload from "../components/FileUpload";
import { generatePDF } from "../lib/pdfGenerator";
import CardPreview from "../components/CardPreview";

interface VocabCard extends Record<string, string | number> {
  'Vocab Word': string;
  'Identifying Part Of Speech': string;
  'Definition': string;
  'Example Sentence': string;
  lineNumber: number;
}

export default function Flashcards() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewCards, setPreviewCards] = useState<VocabCard[]>([]);
  const { toast } = useToast();

  const parseCSV = (file: File): Promise<VocabCard[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transform: (value) => value.trim(),
        complete: (results) => {
          if (results.errors.length > 0) {
            console.error('CSV parsing errors:', results.errors);
            reject(new Error('Failed to parse CSV file'));
            return;
          }

          try {
            const data = results.data
              .map((row: any, index: number) => ({
                ...row,
                originalIndex: index + 2,
                'Vocab Word': row['Vocab Word']?.trim() || '',
                'Identifying Part Of Speech': row['Identifying Part Of Speech']?.trim() || '',
                'Definition': row['Definition']?.trim() || '',
                'Example Sentence': row['Example Sentence']?.trim() || ''
              }))
              .filter((row: any) => {
                return row['Vocab Word'] && 
                  row['Identifying Part Of Speech'] && 
                  row['Definition'] && 
                  row['Example Sentence'];
              })
              .map((row: any) => ({
                ...row,
                lineNumber: row.originalIndex - 1
              }));

            if (data.length === 0) {
              reject(new Error('No valid flashcard data found in CSV'));
              return;
            }

            resolve(data as VocabCard[]);
          } catch (error) {
            console.error('Error processing CSV data:', error);
            reject(new Error('Failed to process CSV data'));
          }
        },
        error: (error) => {
          console.error('CSV parsing error:', error);
          reject(error);
        }
      });
    });
  };

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        throw new Error('Please upload a CSV file');
      }

      const cards = await parseCSV(file);
      setPreviewCards(cards);
      toast({
        title: "Success",
        description: `Successfully loaded ${cards.length} flashcards`,
      });
    } catch (error) {
      console.error('File processing error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to parse CSV file",
        variant: "destructive",
      });
      setPreviewCards([]);
    } finally {
      setIsProcessing(false);
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
      await generatePDF(csvContent);
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
