import Papa from 'papaparse';
import { jsPDF } from 'jspdf';

interface VocabCard {
  'Vocab Word': string;
  'Identifying Part Of Speech': string;
  'Definition': string;
  'Example Sentence': string;
}

type ParseResults = Papa.ParseResult<VocabCard>;
type ParseError = Papa.ParseError;

export async function generatePDF(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    Papa.parse<VocabCard>(file, {
      header: true,
      complete: (results: ParseResults) => {
        try {
          const data = results.data.filter((row: VocabCard) => row['Vocab Word']);
          if (data.length === 0) {
            throw new Error('No valid data found in CSV file');
          }
          createPDF(data);
          resolve();
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Failed to generate PDF'));
        }
      },
      error: (error: Error) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      }
    });
  });
}

function createPDF(data: VocabCard[]) {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'in',
    format: [11, 8.5]
  });

  const cardGroups = chunkArray(data, 4);
  
  // Page dimensions (landscape)
  const pageWidth = 11;  // inches
  const pageHeight = 8.5; // inches
  
  // Card dimensions
  const cardWidth = 5;   // inches
  const cardHeight = 3;  // inches
  
  // Calculate margins to center the grid
  const totalCardWidth = cardWidth * 2;
  const totalCardHeight = cardHeight * 2;
  const marginLeft = (pageWidth - totalCardWidth) / 2;
  const marginTop = (pageHeight - totalCardHeight) / 2;
  
  // Calculate spacing between cards
  const horizontalSpacing = (pageWidth - (2 * cardWidth) - (2 * marginLeft)) / 1;
  const verticalSpacing = (pageHeight - (2 * cardHeight) - (2 * marginTop)) / 1;

  cardGroups.forEach((group, groupIndex) => {
    // Add new page for each group (except first)
    if (groupIndex > 0) {
      pdf.addPage();
    }

    // Front side - Order: 1,3,2,4
    const frontOrder = [0, 2, 1, 3];
    frontOrder.forEach((orderIndex, displayIndex) => {
      const card = group[orderIndex];
      if (!card) return;

      const row = Math.floor(displayIndex / 2);
      const col = displayIndex % 2;
      const x = marginLeft + (col * (cardWidth + horizontalSpacing));
      const y = marginTop + (row * (cardHeight + verticalSpacing));
      
      // Card outline
      pdf.setLineWidth(0.01);
      pdf.rect(x, y, cardWidth, cardHeight);

      // Card number
      const cardNumber = groupIndex * 4 + orderIndex + 1;
      pdf.setFontSize(12);
      pdf.text(`#${cardNumber}`, x + 0.2, y + 0.3);

      // Vocab word (centered)
      const word = card['Vocab Word'] || '';
      pdf.setFontSize(24);
      const wordY = y + (cardHeight * 0.5);
      pdf.text(word, x + (cardWidth / 2), wordY, { align: 'center' });

      // Part of speech (centered, below word)
      const pos = card['Identifying Part Of Speech'] || '';
      pdf.setFontSize(14);
      const posY = y + (cardHeight * 0.7);
      pdf.text(pos, x + (cardWidth / 2), posY, { align: 'center' });
    });

    // Back side page
    pdf.addPage();
    
    // Back side - Order: 2,4,1,3
    const backOrder = [1, 3, 0, 2];
    backOrder.forEach((orderIndex, displayIndex) => {
      const card = group[orderIndex];
      if (!card) return;

      const row = Math.floor(displayIndex / 2);
      const col = displayIndex % 2;
      
      // Calculate position for back side
      const x = marginLeft + (col * (cardWidth + horizontalSpacing));
      const y = marginTop + (row * (cardHeight + verticalSpacing));

      // Card outline
      pdf.setLineWidth(0.01);
      pdf.rect(x, y, cardWidth, cardHeight);

      // Card number
      const cardNumber = groupIndex * 4 + orderIndex + 1;
      pdf.setFontSize(12);
      pdf.text(`#${cardNumber}`, x + 0.2, y + 0.3);

      // Definition
      const definition = card['Definition'] || '';
      pdf.setFontSize(14);
      const wrappedDefinition = wrapText(definition, 40);
      let textY = y + 0.7;

      // Center the definition text
      wrappedDefinition.forEach(line => {
        pdf.text(line, x + (cardWidth / 2), textY, { align: 'center' });
        textY += 0.3;
      });

      // Example sentence
      const sentence = card['Example Sentence'] || '';
      const wrappedSentence = wrapText(sentence, 40);
      textY += 0.4; // Add more space between definition and sentence

      // Center the example sentence
      wrappedSentence.forEach(line => {
        pdf.text(line, x + (cardWidth / 2), textY, { align: 'center' });
        textY += 0.3;
      });
    });
  });

  pdf.save('vocab_cards.pdf');
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function wrapText(text: string, maxChars: number): string[] {
  if (!text) return [];
  
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    if (testLine.length <= maxChars) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
