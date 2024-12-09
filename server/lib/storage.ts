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
      return { 
        success: true, 
        data,
        presignedUrl: `/storage/${path}`
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
        await mkdir(searchPath, { recursive: true });
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
