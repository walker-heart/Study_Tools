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

  async uploadFile(path: string, fileData: Buffer): Promise<StorageResponse> {
    try {
      console.log('Storage Service - Upload request:', {
        path,
        fileSize: fileData.length,
        timestamp: new Date().toISOString()
      });
      
      // Validate input
      if (!path || !fileData) {
        throw new Error('Invalid upload parameters: path and file data are required');
      }

      // Get upload URL
      const uploadResponse = await fetch(`${this.API_BASE}/generate-presigned-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: [{
            path: path,
            operation: 'write',
          } as StorageFileRequest],
        }),
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json() as ReplitStorageError;
        console.error('Failed to get upload URL:', errorData);
        throw new Error(errorData.message || 'Failed to get upload URL');
      }

      const responseData = await uploadResponse.json() as ReplitStorageResponse;
      if (!responseData.urls?.length) {
        throw new Error('No upload URL received');
      }

      const uploadUrl = responseData.urls[0];

      // Upload file
      const putResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: fileData,
      });

      if (!putResponse.ok) {
        throw new Error('Failed to upload file');
      }

      return { presignedUrl: uploadUrl };
    } catch (error) {
      console.error('Storage error:', error);
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
