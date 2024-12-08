import { Card } from "../ui/card";
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
  return (
    <div className="space-y-4">
      <ScrollArea className="h-[600px] rounded-md border">
        <div className="p-4 space-y-4">
          {cards.map((card) => (
            <Card
              key={card.lineNumber}
              className="p-4 grid grid-cols-2 gap-4 hover:bg-accent transition-colors"
            >
              {/* Left side: Word and Part of Speech */}
              <div className="space-y-2 relative">
                <div className="absolute top-0 left-0 text-sm text-gray-500">
                  #{card.lineNumber}
                </div>
                <div className="pt-6">
                  <div className="text-xl font-bold">{card['Vocab Word']}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {card['Identifying Part Of Speach']}
                  </div>
                </div>
              </div>

              {/* Right side: Definition and Example */}
              <div className="space-y-4">
                <div className="text-sm">
                  <p className="text-gray-600">{card['Definition']}</p>
                </div>
                <div className="text-sm">
                  <p className="text-gray-600 italic">{card['Example Sentance']}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
