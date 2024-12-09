import { Client } from '@replit/object-storage';

// Initialize the Object Storage client
const client = new Client();

export interface StorageService {
  uploadFile(file: Buffer, fileName: string): Promise<string>;
  getFileUrl(filePath: string): Promise<string>;
  deleteFile(filePath: string): Promise<void>;
}

export class ReplitStorageService implements StorageService {
  private readonly client: Client;
  
  constructor() {
    this.client = new Client();
  }

  async uploadFile(file: Buffer, fileName: string): Promise<string> {
    const timestamp = new Date().getTime();
    const uniqueFileName = `${timestamp}-${fileName}`;
    
    try {
      await this.client.put(uniqueFileName, file);
      return uniqueFileName;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Failed to upload file to storage');
    }
  }

  async getFileUrl(filePath: string): Promise<string> {
    try {
      // Get a signed URL that expires in 1 hour
      const url = await this.client.getSignedUrl(filePath);
      return url;
    } catch (error) {
      console.error('Error getting file URL:', error);
      throw new Error('Failed to get file URL');
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await this.client.delete(filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file from storage');
    }
  }
}

// Export a singleton instance
export const storageService = new ReplitStorageService();
