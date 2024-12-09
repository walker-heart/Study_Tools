import { Client } from '@replit/object-storage';

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
      const isTextFile = fileName.toLowerCase().endsWith('.csv') || fileName.toLowerCase().endsWith('.json');
      
      if (isTextFile) {
        const textContent = file.toString('utf-8');
        await this.client.uploadFromText(uniqueFileName, textContent);
      } else {
        await this.client.uploadFromBytes(uniqueFileName, file);
      }
      
      console.log(`Successfully uploaded file: ${uniqueFileName}`);
      return uniqueFileName;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFileUrl(filePath: string): Promise<string> {
    try {
      // Use downloadAsText for text files (CSV, JSON) and downloadAsBytes for binary files
      const isTextFile = filePath.toLowerCase().endsWith('.csv') || filePath.toLowerCase().endsWith('.json');
      
      let content: string | Uint8Array;
      if (isTextFile) {
        const { ok, value: textValue, error } = await this.client.downloadAsText(filePath);
        if (!ok) throw error || new Error('Failed to download file');
        content = textValue;
      } else {
        const { ok, value: bytesValue, error } = await this.client.downloadAsBytes(filePath);
        if (!ok) throw error || new Error('Failed to download file');
        content = bytesValue;
      }

      const contentType = this.getContentType(filePath);
      if (isTextFile) {
        return `data:${contentType};charset=utf-8,${encodeURIComponent(content as string)}`;
      } else {
        return `data:${contentType};base64,${Buffer.from(content as Uint8Array).toString('base64')}`;
      }
    } catch (error) {
      console.error('Error getting file URL:', error);
      throw new Error(`Failed to get file URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await this.client.deleteObject(filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file from storage');
    }
  }

  private getContentType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'csv':
        return 'text/csv';
      case 'json':
        return 'application/json';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }
}

// Export a singleton instance
export const storageService = new ReplitStorageService();
