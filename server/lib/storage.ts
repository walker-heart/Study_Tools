import { writeFile, readFile, unlink, readdir, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

interface StorageResult<T> {
  success: boolean;
  error?: string;
  data?: T;
  presignedUrl?: string;
  files?: string[];
}

class ObjectStorage {
  private baseDir: string;

  constructor() {
    this.baseDir = join(process.cwd(), 'storage');
    // Create storage directory if it doesn't exist
    if (!existsSync(this.baseDir)) {
      mkdir(this.baseDir, { recursive: true }).catch(console.error);
    }
  }

  private getFullPath(path: string): string {
    return join(this.baseDir, path);
  }

  async upload(path: string, data: Buffer): Promise<StorageResult<void>> {
    try {
      const fullPath = this.getFullPath(path);
      // Create parent directories if they don't exist
      const dirPath = dirname(fullPath);
      if (!existsSync(dirPath)) {
        await mkdir(dirPath, { recursive: true });
      }
      await writeFile(fullPath, data);
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
      const fullPath = this.getFullPath(path);
      const data = await readFile(fullPath);
      const presignedUrl = `/storage/${path}`; // URL for static file serving
      
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
      const fullPath = this.getFullPath(path);
      if (existsSync(fullPath)) {
        await unlink(fullPath);
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

  async list(prefix: string = ''): Promise<StorageResult<string[]>> {
    try {
      const searchPath = this.getFullPath(prefix);
      if (!existsSync(searchPath)) {
        return { success: true, files: [] };
      }
      
      const files = await readdir(searchPath, { recursive: true });
      const relativePaths = files.map(file => 
        join(prefix, file.toString()).replace(/\\/g, '/')
      );
      
      return { 
        success: true, 
        files: relativePaths
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
