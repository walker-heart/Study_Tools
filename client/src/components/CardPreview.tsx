import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface VocabCard {
  'Vocab Word': string;
  'Identifying Part Of Speach': string;
  'Definition': string;
  'Example Sentance': string;
  lineNumber: number;
}

interface CardPreviewProps {
  cards: VocabCard[];
}

export default function CardPreview({ cards }: CardPreviewProps) {
  // Create groups of 4 cards
  const cardGroups = [];
  for (let i = 0; i < cards.length; i += 4) {
    cardGroups.push(cards.slice(i, Math.min(i + 4, cards.length)));
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Front Side Preview</h3>
        <ScrollArea className="h-[400px] rounded-md border">
          {cardGroups.map((group, groupIndex) => (
            <div key={`front-${groupIndex}`} className="grid grid-cols-2 gap-4 p-4">
              {[0, 2, 1, 3].map((orderIndex) => {
                const card = group[orderIndex];
                if (!card) return null;

                return (
                  <Card key={`front-${groupIndex}-${orderIndex}`} className="p-4 relative min-h-[200px] flex flex-col items-center justify-center">
                    <div className="absolute top-2 left-2 text-sm text-gray-500">
                      #{card.lineNumber}
                    </div>
                    <div className="text-xl font-bold mb-1">{card['Vocab Word']}</div>
                    <div className="text-sm text-gray-500">
                      {card['Identifying Part Of Speach'].toLowerCase()}
                    </div>
                  </Card>
                );
              })}
            </div>
          ))}
        </ScrollArea>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Back Side Preview</h3>
        <ScrollArea className="h-[400px] rounded-md border">
          {cardGroups.map((group, groupIndex) => (
            <div key={`back-${groupIndex}`} className="grid grid-cols-2 gap-4 p-4">
              {[1, 3, 0, 2].map((orderIndex) => {
                const card = group[orderIndex];
                if (!card) return null;

                return (
                  <Card key={`back-${groupIndex}-${orderIndex}`} className="p-4 relative min-h-[200px]">
                    <div className="absolute top-2 left-2 text-sm text-gray-500">
                      #{card.lineNumber}
                    </div>
                    <div className="space-y-4">
                      <div className="text-sm">
                        <p className="font-medium mb-1">Definition:</p>
                        <p className="text-gray-600">{card['Definition']}</p>
                      </div>
                      <div className="text-sm">
                        <p className="font-medium mb-1">Example:</p>
                        <p className="text-gray-600">{card['Example Sentance']}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ))}
        </ScrollArea>
      </div>
    </div>
  );
}
