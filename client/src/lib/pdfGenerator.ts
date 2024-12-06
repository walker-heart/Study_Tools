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
          reject(error);
        }
      },
      error: (error: ParseError) => {
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
    const frontOrder = [0, 2, 1, 3]; // Maps to 1,3,2,4
    frontOrder.forEach((orderIndex, displayIndex) => {
      const card = group[orderIndex];
      if (!card) return;

      const row = Math.floor(displayIndex / 2);
      const col = displayIndex % 2;
      const x = marginLeft + (col * (cardWidth + horizontalSpacing));
      const y = marginTop + (row * (cardHeight + verticalSpacing));
      
      // Card outline
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.01);
      pdf.rect(x, y, cardWidth, cardHeight);

      // Card number
      const cardNumber = String(groupIndex * 4 + orderIndex + 1);
      pdf.setFontSize(12);
      pdf.text(`#${cardNumber}`, x + 0.2, y + 0.3);

      // Vocab word (centered)
      const word = card['Vocab Word'] || '';
      pdf.setFontSize(20);
      const wordY = y + (cardHeight * 0.45);
      pdf.text(word, x + (cardWidth / 2), wordY, {
        align: 'center'
      });

      // Part of speech (centered)
      const pos = card['Identifying Part Of Speech'] || '';
      pdf.setFontSize(12);
      const posY = y + (cardHeight * 0.65);
      pdf.text(pos, x + (cardWidth / 2), posY, {
        align: 'center'
      });
    });

    // Back side - Order: 2,4,1,3
    pdf.addPage();
    const backOrder = [1, 3, 0, 2]; // Maps to 2,4,1,3
    backOrder.forEach((orderIndex, displayIndex) => {
      const card = group[orderIndex];
      if (!card) return;

      const row = Math.floor(displayIndex / 2);
      const col = displayIndex % 2;
      
      // Calculate front side position (for alignment)
      const frontX = marginLeft + (col * (cardWidth + horizontalSpacing));
      const frontY = marginTop + (row * (cardHeight + verticalSpacing));
      
      // Calculate back position (flipped on long edge)
      const backX = pageWidth - (frontX + cardWidth);
      const backY = pageHeight - (frontY + cardHeight);

      // Card outline
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.01);
      pdf.rect(backX, backY, cardWidth, cardHeight);

      // Card number
      const cardNumber = String(groupIndex * 4 + orderIndex + 1);
      pdf.setFontSize(12);
      pdf.text(`#${cardNumber}`, backX + 0.2, backY + 0.3);

      // Definition
      pdf.setFontSize(11);
      const definition = card['Definition'] || '';
      const wrappedDefinition = wrapText(definition, 40);
      let textY = backY + 0.7;
      
      wrappedDefinition.forEach(line => {
        if (line.trim()) {
          pdf.text(line, backX + 0.3, textY);
          textY += 0.25;
        }
      });

      // Example sentence
      const sentence = card['Example Sentence'] || '';
      const wrappedSentence = wrapText(sentence, 40);
      textY += 0.2;
      
      wrappedSentence.forEach(line => {
        if (line.trim()) {
          pdf.text(line, backX + 0.3, textY);
          textY += 0.25;
        }
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
