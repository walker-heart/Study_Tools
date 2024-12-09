import { storage } from '../lib/storage';

interface StorageService {
  saveFlashcardSet(setId: number, filePath: string, fileData: Buffer): Promise<string>;
  savePdfPreview(setId: number, pdfData: Buffer): Promise<string>;
  getFlashcardSet(setId: number, filePath: string): Promise<Buffer>;
  getPdfPreview(setId: number): Promise<Buffer>;
  deleteFlashcardSet(setId: number, filePath: string): Promise<void>;
  listFlashcardSets(userId: number): Promise<{ files: string[]; success: boolean; error?: string; }>;
}

class ReplitStorageService implements StorageService {
  async saveFlashcardSet(setId: number, filePath: string, fileData: Buffer): Promise<string> {
    try {
      const result = await storage.upload(filePath, fileData);
      
      if (!result.success) {
        throw new Error(`Failed to save flashcard set: ${result.error}`);
      }
      
      return filePath;
    } catch (error) {
      console.error(`Error saving flashcard set ${setId}:`, {
        error: error instanceof Error ? error.message : String(error),
        context: {
          setId,
          filePath,
          fileSize: fileData.length,
          timestamp: new Date().toISOString()
        }
      });
      throw new Error('Failed to save flashcard set');
    }
  }

  async getFlashcardSet(setId: number, filePath: string): Promise<Buffer> {
    try {
      const result = await storage.download(filePath);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to download flashcard set');
      }
      
      return result.data;
    } catch (error) {
      console.error(`Error reading flashcard set:`, {
        error: error instanceof Error ? error.message : String(error),
        context: { setId, filePath }
      });
      throw new Error('Failed to read flashcard set');
    }
  }

  async deleteFlashcardSet(setId: number, filePath: string): Promise<void> {
    try {
      const result = await storage.delete(filePath);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete flashcard set');
      }
    } catch (error) {
      console.error(`Error deleting flashcard set:`, {
        error: error instanceof Error ? error.message : String(error),
        context: { setId, filePath }
      });
      throw new Error('Failed to delete flashcard set');
    }
  }

  async savePdfPreview(setId: number, pdfData: Buffer): Promise<string> {
    try {
      const pdfPath = `flashcards/${setId}/preview.pdf`;
      const result = await storage.upload(pdfPath, pdfData);
      
      if (!result.success) {
        throw new Error(`Failed to upload PDF preview: ${result.error}`);
      }
      
      return pdfPath;
    } catch (error) {
      console.error(`Error saving PDF preview for set ${setId}:`, {
        error: error instanceof Error ? error.message : String(error),
        context: {
          setId,
          fileSize: pdfData.length,
          timestamp: new Date().toISOString()
        }
      });
      throw new Error(`Failed to save PDF preview: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getPdfPreview(setId: number): Promise<Buffer> {
    try {
      const pdfPath = `flashcards/${setId}/preview.pdf`;
      const result = await storage.download(pdfPath);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to download PDF preview');
      }
      
      return result.data;
    } catch (error) {
      console.error(`Error reading PDF preview:`, {
        error: error instanceof Error ? error.message : String(error),
        context: { setId }
      });
      throw new Error('Failed to read PDF preview');
    }
  }

  async listFlashcardSets(userId: number): Promise<{ files: string[]; success: boolean; error?: string; }> {
    try {
      const prefix = `flashcards/${userId}/`;
      const result = await storage.list(prefix);
      
      if (!result.success) {
        return {
          files: [],
          success: false,
          error: result.error || 'Failed to list files'
        };
      }
      
      return {
        files: result.files || [],
        success: true
      };
    } catch (error) {
      console.error('Error listing flashcard sets:', {
        error: error instanceof Error ? error.message : String(error),
        context: { userId }
      });
      return {
        files: [],
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list flashcard sets'
      };
    }
  }

  async savePdfPreview(setId: number, pdfData: Buffer): Promise<string> {
    try {
      const pdfPath = `flashcards/${setId}/preview.pdf`;
      const result = await storage.upload(pdfPath, pdfData);
      
      if (!result.success) {
        throw new Error(`Failed to upload PDF preview: ${result.error}`);
      }
      
      return pdfPath;
    } catch (error) {
      console.error(`Error saving PDF preview for set ${setId}:`, {
        error: error instanceof Error ? error.message : String(error),
        context: {
          setId,
          fileSize: pdfData.length,
          timestamp: new Date().toISOString()
        }
      });
      throw new Error(`Failed to save PDF preview: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getPdfPreview(setId: number): Promise<Buffer> {
    try {
      const pdfPath = `flashcards/${setId}/preview.pdf`;
      const result = await storage.download(pdfPath);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to download PDF preview');
      }
      
      return result.data;
    } catch (error) {
      console.error(`Error reading PDF preview:`, {
        error: error instanceof Error ? error.message : String(error),
        context: { setId }
      });
      throw new Error('Failed to read PDF preview');
    }
  }
}

// Export singleton instance
export const storageService = new ReplitStorageService();
