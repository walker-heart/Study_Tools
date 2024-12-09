import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

interface StorageService {
  uploadFile(file: Buffer, fileName: string): Promise<string>;
  getFileUrl(filePath: string): Promise<string>;
  deleteFile(filePath: string): Promise<void>;
}

class FileStorageService implements StorageService {
  private readonly storageDir: string;

  constructor() {
    this.storageDir = join(process.cwd(), 'storage', 'files');
    this.initializeStorage().catch(console.error);
  }

  private async initializeStorage(): Promise<void> {
    if (!existsSync(this.storageDir)) {
      await mkdir(this.storageDir, { recursive: true });
    }
  }

  async uploadFile(file: Buffer, fileName: string): Promise<string> {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueFileName = `${timestamp}_${sanitizedFileName}`;
      const filePath = join(this.storageDir, uniqueFileName);

      // Write file to storage
      await writeFile(filePath, file);
      console.log(`File uploaded successfully: ${uniqueFileName}`);
      
      return uniqueFileName;
    } catch (error) {
      console.error('Upload error:', error);
      throw new Error('Failed to upload file');
    }
  }

  async getFileUrl(filePath: string): Promise<string> {
    try {
      const fullPath = join(this.storageDir, filePath);
      const fileContent = await readFile(fullPath);
      const contentType = this.getContentType(filePath);
      
      // Create data URL
      const base64Content = fileContent.toString('base64');
      return `data:${contentType};base64,${base64Content}`;
    } catch (error) {
      console.error('File access error:', error);
      throw new Error('Failed to access file');
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const fullPath = join(this.storageDir, filePath);
      await unlink(fullPath);
      console.log(`File deleted successfully: ${filePath}`);
    } catch (error) {
      console.error('Delete error:', error);
      throw new Error('Failed to delete file');
    }
  }

  private getContentType(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase() ?? '';
    const mimeTypes: Record<string, string> = {
      'csv': 'text/csv',
      'json': 'application/json',
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }
}

// Export singleton instance
export const storageService = new FileStorageService();