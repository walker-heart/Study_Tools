import { storage } from '../lib/storage';

interface FlashcardSet {
  id: number;
  userId: number;
  title: string;
  filePath: string;
  createdAt: string;
}

interface StorageService {
  saveFlashcardSet(setId: number, filePath: string, fileData: Buffer): Promise<string>;
  getFlashcardSet(setId: number, filePath: string): Promise<Buffer>;
  deleteFlashcardSet(setId: number, filePath: string): Promise<void>;
  listFlashcardSets(userId: number): Promise<{ files: string[]; success: boolean; error?: string; }>;
}

class ReplitStorageService implements StorageService {
  private getFullPath(setId: number, filePath: string): string {
    return `flashcards/${setId}/${filePath}`;
  }

  async saveFlashcardSet(setId: number, filePath: string, fileData: Buffer): Promise<string> {
    try {
      const fullPath = this.getFullPath(setId, filePath);
      const result = await storage.upload(fullPath, fileData);
      
      if (!result.success) {
        throw new Error(`Failed to upload file: ${result.error}`);
      }
      
      return fullPath;
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
      throw new Error(`Failed to save flashcard set: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getFlashcardSet(setId: number, filePath: string): Promise<Buffer> {
    try {
      const fullPath = this.getFullPath(setId, filePath);
      const result = await storage.download(fullPath);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to download file');
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
      const fullPath = this.getFullPath(setId, filePath);
      const result = await storage.delete(fullPath);
      
      if (!result.success) {
        throw new Error(`Failed to delete file: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error deleting flashcard set:`, {
        error: error instanceof Error ? error.message : String(error),
        context: { setId, filePath }
      });
      throw new Error('Failed to delete flashcard set');
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
}

// Export singleton instance
export const storageService = new ReplitStorageService();
