import Papa from 'papaparse';
import { jsPDF } from 'jspdf';

interface VocabCard {
  'Vocab Word': string;
  'Identifying Part Of Speach': string;
  'Definition': string;
  'Example Sentance': string;
  lineNumber: number;
}

type ParseResults = Papa.ParseResult<VocabCard>;

export async function generatePDF(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    Papa.parse<VocabCard>(file, {
      header: true,
      complete: (results: ParseResults) => {
        try {
          const data = results.data
            .filter((row: any) => {
              return row['Vocab Word'] && 
                row['Identifying Part Of Speach'] && 
                row['Definition'] && 
                row['Example Sentance'];
            });
          
          if (data.length === 0) {
            throw new Error('No valid data found in CSV file');
          }
          
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

  // Page dimensions
  const pageWidth = 11;
  const pageHeight = 8.5;
  
  // Card dimensions
  const cardWidth = 4.5;
  const cardHeight = 3.5;
  
  // Margins and spacing
  const marginLeft = 1;
  const marginTop = 1;
  const horizontalSpacing = 0.5;
  const verticalSpacing = 0.5;

  // Process two cards per page (one row with term and definition side by side)
  for (let i = 0; i < data.length; i++) {
    const card = data[i];
    
    // Add new page for each card (except first)
    if (i > 0) {
      pdf.addPage();
    }

    // Calculate vertical position
    const yPos = marginTop;
    
    // === Front side (left) ===
    const frontX = marginLeft;
    
    // Card outline
    pdf.setLineWidth(0.01);
    pdf.rect(frontX, yPos, cardWidth, cardHeight);
    
    // Card number (using lineNumber from CSV)
    pdf.setFontSize(14);
    pdf.text(`#${card.lineNumber}`, frontX + 0.2, yPos + 0.4);
    
    // Vocab word
    pdf.setFontSize(28);
    pdf.text(
      card['Vocab Word'], 
      frontX + (cardWidth / 2), 
      yPos + (cardHeight * 0.4), 
      { align: 'center' }
    );
    
    // Part of speech
    pdf.setFontSize(16);
    pdf.text(
      card['Identifying Part Of Speach'], 
      frontX + (cardWidth / 2), 
      yPos + (cardHeight * 0.6), 
      { align: 'center' }
    );

    // === Back side (right) ===
    const backX = frontX + cardWidth + horizontalSpacing;
    
    // Card outline
    pdf.rect(backX, yPos, cardWidth, cardHeight);
    
    // Card number
    pdf.text(`#${card.lineNumber}`, backX + 0.2, yPos + 0.4);
    
    // Definition section
    let textY = yPos + 0.8;
    
    // "Definition:" label
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text("Definition:", backX + 0.3, textY);
    pdf.setFont(undefined, 'normal');
    textY += 0.4;
    
    // Definition text
    const definition = card['Definition'];
    const wrappedDefinition = wrapText(definition, 45);
    pdf.setFontSize(12);
    wrappedDefinition.forEach(line => {
      pdf.text(line, backX + 0.4, textY);
      textY += 0.25;
    });
    
    // Example section
    textY += 0.3;
    
    // "Example:" label
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text("Example:", backX + 0.3, textY);
    pdf.setFont(undefined, 'normal');
    textY += 0.4;
    
    // Example text
    const example = card['Example Sentance'];
    const wrappedExample = wrapText(example, 45);
    pdf.setFontSize(12);
    wrappedExample.forEach(line => {
      pdf.text(line, backX + 0.4, textY);
      textY += 0.25;
    });
  }

  pdf.save('vocab_cards.pdf');
}

function wrapText(text: string, maxChars: number): string[] {
  if (!text) return [];
  
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    // Handle very long words
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
