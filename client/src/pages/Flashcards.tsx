import { useState, useEffect } from "react";
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

interface FlashcardSet {
  id: number;
  title: string;
  filePath: string | null;
  createdAt: string;
  downloadUrl: string | null;
}

export default function Flashcards() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewCards, setPreviewCards] = useState<VocabCard[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<FlashcardSet[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchUploadedFiles();
  }, []);

  const fetchUploadedFiles = async () => {
    try {
      const response = await fetch('/api/flashcards/sets/files', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      const files = await response.json();
      setUploadedFiles(files);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast({
        title: "Error",
        description: "Failed to fetch uploaded files",
        variant: "destructive",
      });
    }
  };

  const parseCSV = (file: File): Promise<VocabCard[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          const data = results.data
            .map((row: any, index: number) => ({
              ...row,
              originalIndex: index + 2
            }))
            .filter((row: any) => {
              return row['Vocab Word'] && 
                row['Identifying Part Of Speach'] && 
                row['Definition'] && 
                row['Example Sentance'];
            })
            .map((row: any) => ({
              ...row,
              lineNumber: row.originalIndex - 1
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

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleGeneratePDF = async () => {
    if (previewCards.length === 0 || !selectedFile) {
      toast({
        title: "Error",
        description: "Please upload a CSV file first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await fetch('/api/flashcards/sets/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload file');
      }

      const { flashcardSet } = await response.json();
      toast({
        title: "Success",
        description: "File uploaded successfully!",
      });

      // Navigate to preview page using React router
      setLocation(`/preview/${flashcardSet.id}`);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
            {uploadedFiles.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Uploaded Files</h3>
                <div className="space-y-2">
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{file.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(file.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => handleDownload(file.id)}
                        disabled={!file.filePath}
                      >
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
    }
  };

  const handleDownload = async (setId: number) => {
    try {
      const response = await fetch(`/api/flashcards/sets/${setId}/download`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }
      
      const { downloadUrl } = await response.json();
      
      // Open download URL in new tab
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
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
              setSelectedFile={setSelectedFile}
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

        {uploadedFiles.length > 0 && (
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Uploaded Files</h2>
              <div className="space-y-2">
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{file.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(file.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => handleDownload(file.id)}
                      disabled={!file.filePath}
                    >
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

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
