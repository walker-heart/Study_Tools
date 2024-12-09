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
      console.log('Starting flashcard set upload:', {
        setId,
        filePath,
        fileSize: fileData.length,
        timestamp: new Date().toISOString()
      });

      const maxRetries = 3;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const uploadResult = await storage.uploadFile(filePath, fileData);
          if (uploadResult.error) {
            throw new Error(`Failed to upload file: ${uploadResult.error}`);
          }
          console.log('Successfully uploaded flashcard set:', {
            setId,
            filePath,
            attempt,
            timestamp: new Date().toISOString()
          });
          return filePath;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.error(`Upload attempt ${attempt} failed:`, {
            error: lastError.message,
            setId,
            attempt,
            timestamp: new Date().toISOString()
          });
          
          if (attempt === maxRetries) {
            throw lastError;
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        }
      }

      throw lastError || new Error('Failed to save flashcard set after all retries');
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
      const downloadResult = await storage.downloadFile(filePath);
      if (downloadResult.error) {
        throw new Error(`Failed to download file: ${downloadResult.error}`);
      }

      const response = await fetch(downloadResult.presignedUrl!);
      if (!response.ok) {
        throw new Error('Failed to download file content');
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.error(`Error reading flashcard set ${setId}:`, error);
      throw new Error('Failed to read flashcard set');
    }
  }

  async deleteFlashcardSet(setId: number, filePath: string): Promise<void> {
    try {
      const deleteResult = await storage.deleteFile(filePath);
      if (deleteResult.error) {
        throw new Error(`Failed to delete file: ${deleteResult.error}`);
      }
    } catch (error) {
      console.error(`Error deleting flashcard set ${setId}:`, error);
      throw new Error('Failed to delete flashcard set');
    }
  }

  async listFlashcardSets(userId: number): Promise<string[]> {
    try {
      const prefix = `flashcards/${userId}/`;
      const listResult = await storage.listFiles(prefix);

      if (listResult.error) {
        throw new Error(`Failed to list files: ${listResult.error}`);
      }

      return listResult.files?.map(file => file.path) || [];
    } catch (error) {
      console.error('Error listing flashcard sets:', error);
      throw new Error('Failed to list flashcard sets');
    }
  }
}

// Export singleton instance
export const storageService = new ReplitStorageService();