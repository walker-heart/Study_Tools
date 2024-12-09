import fetch from 'node-fetch';

interface StorageResponse {
  presignedUrl?: string;
  error?: string;
  files?: StorageFile[];
}

interface StorageFile {
  path: string;
  size?: number;
  lastModified?: string;
}

interface ReplitStorageResponse {
  urls: string[];
}

interface ReplitStorageError {
  error: string;
  message: string;
}

interface StorageFileRequest {
  path: string;
  operation: 'read' | 'write' | 'list';
}

interface StorageListResponse {
  files: StorageFile[];
}

class ObjectStorage {
  private readonly API_BASE = 'https://api.replit.com/v1/replspace/object-storage';
  private readonly defaultBucketId: string;

  constructor() {
    // Get bucket ID from environment
    const bucketId = process.env.REPLIT_DB_ID || process.env.REPL_ID;
    if (!bucketId) {
      console.warn('Warning: No bucket ID found in environment variables');
    }
    this.defaultBucketId = bucketId || '';
    
    // Log initialization
    console.log('Object Storage Service initialized:', {
      apiBase: this.API_BASE,
      bucketId: this.defaultBucketId,
      timestamp: new Date().toISOString()
    });
  }

  private async retryFetch(url: string, options: any, retries = 5): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`Attempt ${i + 1} to fetch ${url}`);
        
        // Add DNS resolution timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            ...options.headers,
            'Accept': 'application/json',
            'Connection': 'keep-alive'
          }
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response;
      } catch (error) {
        console.error(`Attempt ${i + 1} failed:`, {
          error: error instanceof Error ? error.message : String(error),
          attempt: i + 1,
          timestamp: new Date().toISOString()
        });
        
        if (i === retries - 1) {
          throw new Error(`Failed after ${retries} attempts: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // Exponential backoff with jitter
        const delay = Math.min(1000 * Math.pow(2, i) + Math.random() * 1000, 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('All retry attempts failed');
  }

  async uploadFile(path: string, fileData: Buffer): Promise<StorageResponse> {
    try {
      // Validate bucket configuration
      if (!this.defaultBucketId) {
        throw new Error('Storage is not properly configured: Missing bucket ID');
      }

      console.log('Storage Service - Starting upload:', {
        path,
        fileSize: fileData.length,
        bucketId: this.defaultBucketId,
        timestamp: new Date().toISOString()
      });
      
      // Validate input
      if (!path || !fileData) {
        throw new Error('Invalid upload parameters: path and file data are required');
      }

      // Add bucket ID to path if not present
      const fullPath = path.startsWith(this.defaultBucketId) ? path : `${this.defaultBucketId}/${path}`;

      // Get upload URL with retry logic
      console.log('Requesting presigned URL...');
      const uploadResponse = await this.retryFetch(`${this.API_BASE}/generate-presigned-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Replit-Bucket-Id': this.defaultBucketId
        },
        body: JSON.stringify({
          files: [{
            path: fullPath,
            operation: 'write',
          } as StorageFileRequest],
        }),
      });

      console.log('Presigned URL response status:', uploadResponse.status);

      if (!uploadResponse.ok) {
        let errorMessage = 'Failed to get upload URL';
        try {
          const errorData = await uploadResponse.json() as ReplitStorageError;
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(errorMessage);
      }

      const responseData = await uploadResponse.json() as ReplitStorageResponse;
      if (!responseData.urls?.length) {
        throw new Error('No upload URL received from storage service');
      }

      const uploadUrl = responseData.urls[0];
      console.log('Got presigned URL, attempting upload...');

      // Upload file with retry logic
      const putResponse = await this.retryFetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileData.length.toString()
        },
        body: fileData,
      });

      console.log('Upload completed with status:', putResponse.status);

      if (!putResponse.ok) {
        throw new Error(`Failed to upload file: ${putResponse.status} ${putResponse.statusText}`);
      }

      console.log('Upload successful:', {
        path: fullPath,
        size: fileData.length,
        timestamp: new Date().toISOString()
      });

      return { presignedUrl: uploadUrl };
    } catch (error) {
      console.error('Storage error:', {
        error: error instanceof Error ? error.message : String(error),
        path,
        timestamp: new Date().toISOString()
      });
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async downloadFile(path: string): Promise<StorageResponse> {
    try {
      const response = await fetch(`${this.API_BASE}/generate-presigned-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: [{
            path: path,
            operation: 'read',
          } as StorageFileRequest],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as ReplitStorageError;
        throw new Error(errorData.message || 'Failed to get download URL');
      }

      const responseData = await response.json() as ReplitStorageResponse;
      if (!responseData.urls?.length) {
        throw new Error('No download URL received');
      }

      return { presignedUrl: responseData.urls[0] };
    } catch (error) {
      console.error('Storage error:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async deleteFile(path: string): Promise<StorageResponse> {
    try {
      const response = await fetch(`${this.API_BASE}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: [{ path }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as ReplitStorageError;
        throw new Error(errorData.message || 'Failed to delete file');
      }

      return {};
    } catch (error) {
      console.error('Storage error:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async listFiles(prefix?: string): Promise<StorageResponse> {
    try {
      const response = await fetch(`${this.API_BASE}/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefix: prefix || '',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as ReplitStorageError;
        throw new Error(errorData.message || 'Failed to list files');
      }

      const data = await response.json() as StorageListResponse;
      return { files: data.files };
    } catch (error) {
      console.error('Storage error:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const storage = new ObjectStorage();
