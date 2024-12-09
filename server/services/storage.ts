import { storage } from '../lib/storage';

interface StorageService {
  saveFlashcardSet(setId: number, filePath: string, fileData: Buffer): Promise<string>;
  getFlashcardSet(setId: number, filePath: string): Promise<Buffer>;
  deleteFlashcardSet(setId: number, filePath: string): Promise<void>;
  listFlashcardSets(userId: number): Promise<{ files: string[]; success: boolean; error?: string; }>;
}

class ReplitStorageService implements StorageService {
  async saveFlashcardSet(setId: number, filePath: string, fileData: Buffer): Promise<string> {
    try {
      // Ensure proper file path format
      const sanitizedPath = filePath.replace(/\/{2,}/g, '/').replace(/^\//, '');
      
      console.log('Attempting to save flashcard set:', {
        setId,
        path: sanitizedPath,
        fileSize: fileData.length,
        timestamp: new Date().toISOString()
      });
      
      // Attempt upload
      const result = await storage.upload(sanitizedPath, fileData);
      
      if (!result.success) {
        console.error('Storage upload failed:', {
          error: result.error,
          setId,
          path: sanitizedPath
        });
        throw new Error(`Failed to save flashcard set: ${result.error}`);
      }
      
      console.log('Successfully saved flashcard set:', {
        setId,
        path: sanitizedPath,
        timestamp: new Date().toISOString()
      });
      
      return sanitizedPath;
    } catch (error) {
      console.error(`Error saving flashcard set ${setId}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
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