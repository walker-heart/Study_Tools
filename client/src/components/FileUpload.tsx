import { ChangeEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface FileUploadResponse {
  message: string;
  flashcardSet: {
    id: number;
    title: string;
    filePath: string;
  };
}

interface FileUploadProps {
  onFileSelect: (file: File) => Promise<void>;
  isProcessing: boolean;
  setSelectedFile: (file: File | null) => void;
}

interface FileValidationError extends Error {
  code: 'FILE_SIZE' | 'FILE_TYPE' | 'FILE_CONTENT';
}

export default function FileUpload({ onFileSelect, isProcessing, setSelectedFile }: FileUploadProps) {
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  const validateFile = (file: File): void | never => {
    if (!file.name.endsWith('.csv')) {
      throw Object.assign(new Error('Please upload a CSV file'), {
        code: 'FILE_TYPE' as const,
      });
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      throw Object.assign(new Error('File size must be less than 5MB'), {
        code: 'FILE_SIZE' as const,
      });
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      validateFile(file);
      setFileToUpload(file);
      setSelectedFile(file);
    } catch (error) {
      const err = error as FileValidationError;
      toast({
        title: "Error",
        description: err.message || "Invalid file selected",
        variant: "destructive",
      });
      setFileToUpload(null);
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!fileToUpload) return;

    try {
      setUploadProgress(0);
      
      // Start upload progress animation
      const interval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      await onFileSelect(fileToUpload);
      
      clearInterval(interval);
      setUploadProgress(100);
      
      toast({
        title: "Success",
        description: "File uploaded successfully. Redirecting to preview...",
      });

    } catch (error) {
      const err = error as FileValidationError;
      toast({
        title: "Error",
        description: err.message || "Failed to upload file",
        variant: "destructive",
      });
      setSelectedFile(null);
    } finally {
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid w-full max-w-sm items-center gap-1.5">
        <Label htmlFor="file">CSV File</Label>
        <Input
          id="file"
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          disabled={isProcessing}
        />
        
        {fileToUpload && (
          <div className="mt-2">
            <p className="text-sm text-muted-foreground">
              Selected file: {fileToUpload.name}
            </p>
            <Button 
              className="mt-2"
              onClick={handleUpload}
              disabled={isProcessing || !fileToUpload}
            >
              {isProcessing ? "Uploading..." : "Upload File"}
            </Button>
          </div>
        )}

        {(uploadProgress > 0 || isProcessing) && (
          <div className="space-y-2 mt-2">
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-sm text-muted-foreground">
              {isProcessing ? "Processing file..." : `Uploading: ${uploadProgress}%`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
