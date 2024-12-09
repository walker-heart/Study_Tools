import { storage } from '../lib/storage';

interface StorageService {
  saveFlashcardSet(userId: number, filePath: string, fileData: Buffer): Promise<string>;
  getFlashcardSet(userId: number, filePath: string): Promise<Buffer>;
  deleteFlashcardSet(userId: number, filePath: string): Promise<void>;
  listFlashcardSets(userId: number): Promise<{ files: string[]; success: boolean; error?: string; }>;
  savePdfPreview(setId: number, pdfData: Buffer): Promise<string>;
}

class ReplitStorageService implements StorageService {
  private getFullPath(userId: number, filePath: string): string {
    return `storage/flashcards/${userId}/${filePath}`;
  }

  async saveFlashcardSet(userId: number, filePath: string, fileData: Buffer): Promise<string> {
    try {
      const fullPath = this.getFullPath(userId, filePath);
      const result = await storage.upload(fullPath, fileData);
      
      if (!result.success) {
        throw new Error(`Failed to save flashcard set: ${result.error}`);
      }
      
      return fullPath;
    } catch (error) {
      console.error(`Error saving flashcard set:`, {
        error: error instanceof Error ? error.message : String(error),
        context: {
          userId,
          filePath,
          fileSize: fileData.length,
          timestamp: new Date().toISOString()
        }
      });
      throw new Error('Failed to save flashcard set');
    }
  }

  async getFlashcardSet(userId: number, filePath: string): Promise<Buffer> {
    try {
      const fullPath = this.getFullPath(userId, filePath);
      const result = await storage.download(fullPath);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to download flashcard set');
      }
      
      return result.data;
    } catch (error) {
      console.error(`Error reading flashcard set:`, {
        error: error instanceof Error ? error.message : String(error),
        context: { userId, filePath }
      });
      throw new Error('Failed to read flashcard set');
    }
  }

  async deleteFlashcardSet(userId: number, filePath: string): Promise<void> {
    try {
      const fullPath = this.getFullPath(userId, filePath);
      const result = await storage.delete(fullPath);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete flashcard set');
      }
    } catch (error) {
      console.error(`Error deleting flashcard set:`, {
        error: error instanceof Error ? error.message : String(error),
        context: { userId, filePath }
      });
      throw new Error('Failed to delete flashcard set');
    }
  }

  async listFlashcardSets(userId: number): Promise<{ files: string[]; success: boolean; error?: string; }> {
    try {
      const prefix = `storage/flashcards/${userId}/`;
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
      const pdfPath = `storage/flashcards/previews/${setId}/preview.pdf`;
      const result = await storage.upload(pdfPath, pdfData);
      
      if (!result.success) {
        throw new Error(`Failed to save PDF preview: ${result.error}`);
      }
      
      return pdfPath;
    } catch (error) {
      console.error(`Error saving PDF preview:`, {
        error: error instanceof Error ? error.message : String(error),
        context: {
          setId,
          timestamp: new Date().toISOString()
        }
      });
      throw new Error('Failed to save PDF preview');
    }
  }
}

// Export singleton instance
export const storageService = new ReplitStorageService();