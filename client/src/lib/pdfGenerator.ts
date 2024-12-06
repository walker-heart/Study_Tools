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
  const cardWidth = 5;
  const cardHeight = 3;
  const marginLeft = 0.5;
  const marginTop = 0.5;
  const spacing = 0.5;

  cardGroups.forEach((group, groupIndex) => {
    if (groupIndex > 0) {
      pdf.addPage();
    }

    // Front side
    group.forEach((card, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const x = marginLeft + (col * (cardWidth + spacing));
      const y = marginTop + (row * (cardHeight + spacing));
      
      // Card outline
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.01);
      pdf.rect(x, y, cardWidth, cardHeight);

      // Card number
      pdf.setFontSize(10);
      pdf.text(`#${groupIndex * 4 + index + 1}`, x + 0.2, y + 0.3);

      // Vocab word
      pdf.setFontSize(16);
      pdf.text(card['Vocab Word'], x + cardWidth/2, y + cardHeight/2 - 0.2, {
        align: 'center'
      });

      // Part of speech
      pdf.setFontSize(12);
      pdf.text(card['Identifying Part Of Speech'], x + cardWidth/2, y + cardHeight/2 + 0.3, {
        align: 'center'
      });
    });

    // Back side
    pdf.addPage();
    group.forEach((card, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      
      // Calculate rotated position
      const frontX = marginLeft + (col * (cardWidth + spacing));
      const frontY = marginTop + (row * (cardHeight + spacing));
      const backX = 11 - (frontX + cardWidth);
      const backY = 8.5 - (frontY + cardHeight);

      // Card outline
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.01);
      pdf.rect(backX, backY, cardWidth, cardHeight);

      // Card number
      pdf.setFontSize(10);
      pdf.text(`#${groupIndex * 4 + index + 1}`, backX + 0.2, backY + 0.3);

      // Definition
      pdf.setFontSize(12);
      const definition = wrapText(card['Definition'], 45);
      let textY = backY + 0.8;
      definition.forEach(line => {
        pdf.text(line, backX + 0.3, textY);
        textY += 0.2;
      });

      // Example sentence
      textY += 0.2;
      const sentence = wrapText(card['Example Sentence'], 45);
      sentence.forEach(line => {
        pdf.text(line, backX + 0.3, textY);
        textY += 0.2;
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

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine + word + ' ';
    if (testLine.length > maxWidth) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine = testLine;
    }
  });
  
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines;
}
