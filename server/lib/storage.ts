import { Client } from '@replit/object-storage';

class ObjectStorage {
  private client: Client;

  constructor() {
    this.client = new Client();
  }

  async upload(path: string, data: Buffer) {
    try {
      const result = await this.client.put(path, data);
      if (!result.ok) {
        console.error('Upload failed:', result.error);
        return { success: false, error: result.error };
      }
      console.log('Upload successful:', path);
      return { success: true };
    } catch (error) {
      console.error('Upload error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async download(path: string) {
    try {
      const result = await this.client.downloadToMemory(path);
      if (!result.ok) {
        console.error('Download failed:', result.error);
        return { success: false, error: result.error };
      }
      return { success: true, data: result.value };
    } catch (error) {
      console.error('Download error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async delete(path: string) {
    try {
      const result = await this.client.delete(path);
      if (!result.ok) {
        console.error('Delete failed:', result.error);
        return { success: false, error: result.error };
      }
      return { success: true };
    } catch (error) {
      console.error('Delete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async list(prefix?: string) {
    try {
      const result = await this.client.list(prefix);
      if (!result.ok) {
        console.error('List failed:', result.error);
        return { success: false, error: result.error, files: [] };
      }
      return { 
        success: true, 
        files: result.value.map(file => file.name)
      };
    } catch (error) {
      console.error('List error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        files: []
      };
    }
  }
}

// Export a singleton instance
export const storage = new ObjectStorage();
