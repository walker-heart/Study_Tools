import { Client } from '@replit/object-storage';
import type { Result } from '@replit/object-storage/dist/result';

interface StorageResponse {
  error?: string;
  success: boolean;
}

class ObjectStorage {
  private client: Client;

  constructor() {
    this.client = new Client();
  }

  async uploadFromMemory(path: string, fileData: Buffer): Promise<StorageResponse> {
    try {
      const result = await this.client.uploadFromMemory(path, fileData);
      if (!result.ok) {
        throw new Error(result.error);
      }
      return { success: true };
    } catch (error) {
      console.error('Storage upload error:', {
        error: error instanceof Error ? error.message : String(error),
        path,
        timestamp: new Date().toISOString()
      });
      return { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async downloadToMemory(path: string): Promise<{ data: Buffer | null; error?: string }> {
    try {
      const result = await this.client.downloadToMemory(path);
      if (!result.ok) {
        throw new Error(result.error);
      }
      return { data: result.value };
    } catch (error) {
      console.error('Storage download error:', error);
      return { 
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async delete(path: string): Promise<StorageResponse> {
    try {
      const result = await this.client.delete(path);
      if (!result.ok) {
        throw new Error(result.error);
      }
      return { success: true };
    } catch (error) {
      console.error('Storage delete error:', error);
      return { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async list(prefix?: string): Promise<{ files: string[]; error?: string }> {
    try {
      const result = await this.client.list(prefix);
      if (!result.ok) {
        throw new Error(result.error);
      }
      return { 
        files: result.value.map(file => file.name)
      };
    } catch (error) {
      console.error('Storage list error:', error);
      return { 
        files: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const storage = new ObjectStorage();
