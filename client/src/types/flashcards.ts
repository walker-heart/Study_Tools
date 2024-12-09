export interface VocabCard {
  'Vocab Word': string;
  'Identifying Part Of Speach': string;
  'Definition': string;
  'Example Sentance': string;
  lineNumber?: number;
}

export interface FlashcardSet {
  id: number;
  title: string;
  description?: string;
  filePath?: string;
  urlPath?: string;
  pdfPath?: string;
  downloadUrl?: string;
  cards?: VocabCard[];
  createdAt: string;
  updatedAt: string;
}
