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
  listFlashcardSets(userId: number): Promise<string[]>;
}

class ReplitStorageService implements StorageService {
  async saveFlashcardSet(setId: number, filePath: string, fileData: Buffer): Promise<string> {
    try {
      const path = `flashcards/${setId}/${filePath}`;
      const uploadResult = await storage.uploadFromMemory(path, fileData);
      
      if (!uploadResult.success) {
        throw new Error(`Failed to upload file: ${uploadResult.error}`);
      }
      
      return path;
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

  async getFlashcardSet(_setId: number, filePath: string): Promise<Buffer> {
    try {
      const result = await storage.downloadToMemory(filePath);
      if (!result.data) {
        throw new Error(result.error || 'Failed to download file content');
      }
      return result.data;
    } catch (error) {
      console.error(`Error reading flashcard set:`, error);
      throw new Error('Failed to read flashcard set');
    }
  }

  async deleteFlashcardSet(_setId: number, filePath: string): Promise<void> {
    try {
      const result = await storage.delete(filePath);
      if (!result.success) {
        throw new Error(`Failed to delete file: ${result.error}`);
      }
    } catch (error) {
      console.error(`Error deleting flashcard set:`, error);
      throw new Error('Failed to delete flashcard set');
    }
  }

  async listFlashcardSets(userId: number): Promise<string[]> {
    try {
      const prefix = `flashcards/${userId}/`;
      const result = await storage.list(prefix);
      if (result.error) {
        throw new Error(`Failed to list files: ${result.error}`);
      }
      return result.files;
    } catch (error) {
      console.error('Error listing flashcard sets:', error);
      throw new Error('Failed to list flashcard sets');
    }
  }
}

// Export singleton instance
export const storageService = new ReplitStorageService();