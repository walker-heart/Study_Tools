import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FlashcardSet {
  id: number;
  title: string;
  filePath: string | null;
  createdAt: string;
  downloadUrl: string | null;
}

interface FileListProps {
  files: FlashcardSet[];
  onFileSelect: (setId: number) => void;
}

export default function FileList({ files, onFileSelect }: FileListProps) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Uploaded Files</h2>
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">{file.title}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(file.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => onFileSelect(file.id)}
                disabled={!file.filePath}
              >
                View & Download
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
