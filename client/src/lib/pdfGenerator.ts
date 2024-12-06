import Papa from 'papaparse';
import { jsPDF } from 'jspdf';

interface VocabCard {
  'Vocab Word': string;
  'Identifying Part Of Speach': string; // Handle misspelling in CSV
  'Definition': string;
  'Example Sentance': string; // Handle misspelling in CSV
  lineNumber: number; // Add line number tracking
}

type ParseResults = Papa.ParseResult<VocabCard>;
type ParseError = Papa.ParseError;

export async function generatePDF(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    Papa.parse<VocabCard>(file, {
      header: true,
      complete: (results: ParseResults) => {
        try {
          // Log headers for debugging
          console.log('CSV Headers:', results.meta.fields);
          
          // Map data with original line numbers from CSV
          const data = results.data
            .map((row: any, index: number) => ({
              ...row,
              originalIndex: index + 2 // Add 2 because Papa.parse starts counting from 0
            }))
            .filter((row: any) => {
              return row['Vocab Word'] && 
                row['Identifying Part Of Speach'] && 
                row['Definition'] && 
                row['Example Sentance'];
            })
            .map((row: any) => ({
              ...row,
              lineNumber: row.originalIndex - 1 // Subtract 1 from the cell number as requested
            }));
          
          if (data.length === 0) {
            throw new Error('No valid data found in CSV file. Please ensure all required columns are present: Vocab Word, Identifying Part Of Speach, Definition, Example Sentance');
          }
          
          console.log('Processing data:', data);
          createPDF(data);
          resolve();
        } catch (error) {
          console.error('PDF Generation Error:', error);
          reject(error instanceof Error ? error : new Error('Failed to generate PDF'));
        }
      },
      error: (error: Error) => {
        console.error('CSV Parsing Error:', error);
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
  
  // Fixed card dimensions for consistency
  const cardWidth = 5;   // inches
  const cardHeight = 3;  // inches
  
  // Calculate margins to center the grid
  const totalCardWidth = cardWidth * 2;  // 2 cards per row
  const totalCardHeight = cardHeight * 2; // 2 cards per column
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

      // Card number (top-left corner) - Use line number from CSV
      const cardNumber = card.lineNumber;
      pdf.setFontSize(14);
      pdf.text(`#${cardNumber}`, x + 0.2, y + 0.4);

      // Vocab word (centered)
      const word = card['Vocab Word'] || '';
      pdf.setFontSize(28);
      pdf.text(word, x + (cardWidth / 2), y + (cardHeight * 0.6), { align: 'center' });

      // Part of speech (below word)
      const pos = card['Identifying Part Of Speach'] || '';
      pdf.setFontSize(16);
      pdf.text(pos, x + (cardWidth / 2), y + (cardHeight * 0.8), { align: 'center' });
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

      // Card number (top-left corner) - Use line number from CSV
      const cardNumber = card.lineNumber;
      pdf.setFontSize(14);
      pdf.text(`#${cardNumber}`, x + 0.2, y + 0.3);

      // Calculate optimal font sizes based on content length
      const definition = card['Definition'] || '';
      const sentence = card['Example Sentance'] || '';
      
      // Adjust font size based on content length
      const baseSize = 16;
      const defLength = definition.length;
      const sentLength = sentence.length;
      
      // Dynamic font sizing
      const defFontSize = Math.max(12, baseSize - Math.floor(defLength / 50));
      const sentFontSize = Math.max(12, baseSize - Math.floor(sentLength / 50));
      
      // Definition
      pdf.setFontSize(defFontSize);
      const wrappedDefinition = wrapText(definition, Math.floor(45 * (16/defFontSize)));
      let textY = y + 0.9; // Increased initial Y position

      wrappedDefinition.forEach(line => {
        pdf.text(line, x + (cardWidth / 2), textY, { align: 'center' });
        textY += 0.2 * (defFontSize/16); // Adjust line spacing based on font size
      });

      // Example sentence
      pdf.setFontSize(sentFontSize);
      const wrappedSentence = wrapText(sentence, Math.floor(45 * (16/sentFontSize)));
      textY += 0.4; // Increased space between definition and sentence

      wrappedSentence.forEach(line => {
        pdf.text(line, x + (cardWidth / 2), textY, { align: 'center' });
        textY += 0.2 * (sentFontSize/16); // Adjust line spacing based on font size
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
    // Handle very long words by splitting them
    if (word.length > maxChars) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      // Split long word into chunks
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }
      return;
    }

    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    if (testLine.length <= maxChars) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    }
  });

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  return lines;
}
