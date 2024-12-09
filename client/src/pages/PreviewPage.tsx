import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import CardPreview from "@/components/CardPreview";
import { ArrowLeft } from "lucide-react";

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
  downloadUrl: string | null;
}

export default function PreviewPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/preview/:setId");
  const [isLoading, setIsLoading] = useState(true);
  const [flashcardSet, setFlashcardSet] = useState<FlashcardSet | null>(null);
  const [previewCards, setPreviewCards] = useState<VocabCard[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!params?.setId) {
      setLocation("/flashcards");
      return;
    }
    fetchPreviewData();
  }, [params?.setId]);

  const fetchPreviewData = async () => {
    try {
      const response = await fetch(`/api/flashcards/sets/${params?.setId}/preview`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch preview data');
      }

      const data = await response.json();
      setFlashcardSet(data.set);
      setPreviewCards(data.cards);
    } catch (error) {
      console.error('Error fetching preview:', error);
      toast({
        title: "Error",
        description: "Failed to load preview data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!flashcardSet?.id) return;
    
    try {
      const response = await fetch(`/api/flashcards/sets/${flashcardSet.id}/download`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }
      
      const { downloadUrl } = await response.json();
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

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => setLocation("/flashcards")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Flashcards
        </Button>
        <h1 className="text-3xl font-bold">
          {flashcardSet?.title || 'Preview'}
        </h1>
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Preview Cards</h2>
            <Button onClick={handleDownload} disabled={!flashcardSet?.filePath}>
              Download CSV
            </Button>
          </div>
          <CardPreview cards={previewCards} />
        </Card>
      </div>
    </div>
  );
}
