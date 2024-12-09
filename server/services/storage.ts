import { mkdir, writeFile, readFile, unlink, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

interface FlashcardSet {
  id: number;
  userId: number;
  title: string;
  cards: Array<{
    text: string;
    createdAt: string;
  }>;
  createdAt: string;
}

interface StorageService {
  saveFlashcardSet(setId: number, data: FlashcardSet): Promise<void>;
  getFlashcardSet(setId: number): Promise<FlashcardSet>;
  deleteFlashcardSet(setId: number): Promise<void>;
  listFlashcardSets(userId: number): Promise<number[]>;
}

class FileStorageService implements StorageService {
  private readonly storageDir: string;

  constructor() {
    this.storageDir = join(process.cwd(), 'storage', 'flashcards');
    this.initializeStorage().catch(console.error);
  }

  private async initializeStorage(): Promise<void> {
    if (!existsSync(this.storageDir)) {
      await mkdir(this.storageDir, { recursive: true });
    }
  }

  private getSetFilePath(setId: number): string {
    return join(this.storageDir, `set_${setId}.json`);
  }

  async saveFlashcardSet(setId: number, data: FlashcardSet): Promise<void> {
    try {
      const filePath = this.getSetFilePath(setId);
      await writeFile(filePath, JSON.stringify(data, null, 2));
      console.log(`Flashcard set ${setId} saved successfully`);
    } catch (error) {
      console.error(`Error saving flashcard set ${setId}:`, error);
      throw new Error('Failed to save flashcard set');
    }
  }

  async getFlashcardSet(setId: number): Promise<FlashcardSet> {
    try {
      const filePath = this.getSetFilePath(setId);
      const fileContent = await readFile(filePath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      console.error(`Error reading flashcard set ${setId}:`, error);
      throw new Error('Failed to read flashcard set');
    }
  }

  async deleteFlashcardSet(setId: number): Promise<void> {
    try {
      const filePath = this.getSetFilePath(setId);
      await unlink(filePath);
      console.log(`Flashcard set ${setId} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting flashcard set ${setId}:`, error);
      throw new Error('Failed to delete flashcard set');
    }
  }

  async listFlashcardSets(userId: number): Promise<number[]> {
    try {
      const files = await readdir(this.storageDir);
      const setIds = files
        .filter(file => file.startsWith('set_') && file.endsWith('.json'))
        .map(file => {
          const match = file.match(/set_(\d+)\.json/);
          return match ? parseInt(match[1], 10) : null;
        })
        .filter((id): id is number => id !== null);
      
      // Filter sets by userId by reading each file
      const userSets = await Promise.all(
        setIds.map(async id => {
          try {
            const set = await this.getFlashcardSet(id);
            return set.userId === userId ? id : null;
          } catch {
            return null;
          }
        })
      );
      
      return userSets.filter((id): id is number => id !== null);
    } catch (error) {
      console.error('Error listing flashcard sets:', error);
      throw new Error('Failed to list flashcard sets');
    }
  }
}

// Export singleton instance
export const storageService = new FileStorageService();