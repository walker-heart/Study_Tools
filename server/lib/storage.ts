import { Client } from '@replit/object-storage';
import { Readable } from 'stream';

interface StorageResult<T> {
  success: boolean;
  error?: string;
  data?: T;
  presignedUrl?: string;
  files?: string[];
}

class ObjectStorage {
  private client: Client;

  constructor() {
    this.client = new Client();
  }

  async upload(path: string, data: Buffer): Promise<StorageResult<void>> {
    try {
      await this.client.putObject({
        key: path,
        body: data
      });
      return { success: true };
    } catch (error) {
      console.error('Upload error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async download(path: string): Promise<StorageResult<Buffer>> {
    try {
      const result = await this.client.getObject({
        key: path
      });
      
      if (!result) {
        throw new Error('File not found');
      }

      // Convert the response to a buffer
      const chunks: Buffer[] = [];
      for await (const chunk of result.body) {
        chunks.push(Buffer.from(chunk));
      }
      const data = Buffer.concat(chunks);

      // Get presigned URL
      const presignedUrl = await this.client.getSignedUrl({
        key: path,
        expiresIn: 3600 // 1 hour
      });

      return { 
        success: true, 
        data,
        presignedUrl
      };
    } catch (error) {
      console.error('Download error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async delete(path: string): Promise<StorageResult<void>> {
    try {
      await this.client.deleteObject({
        key: path
      });
      return { success: true };
    } catch (error) {
      console.error('Delete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async list(prefix?: string): Promise<StorageResult<string[]>> {
    try {
      const result = await this.client.listObjects({
        prefix: prefix || ''
      });

      return { 
        success: true, 
        files: result.objects.map(obj => obj.key)
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

// Export singleton instance
export const storage = new ObjectStorage();
