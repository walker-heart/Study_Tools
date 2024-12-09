import fetch from 'node-fetch';

interface StorageResponse {
  presignedUrl?: string;
  error?: string;
}

class ObjectStorage {
  private readonly API_BASE = 'https://api.replit.com/v1/replspace/object-storage';

  async uploadFile(path: string, data: Buffer): Promise<StorageResponse> {
    try {
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
          }],
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { urls } = await uploadResponse.json();
      const uploadUrl = urls[0];

      // Upload file
      const putResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: data,
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
          }],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const { urls } = await response.json();
      return { presignedUrl: urls[0] };
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
        throw new Error('Failed to delete file');
      }

      return {};
    } catch (error) {
      console.error('Storage error:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const storage = new ObjectStorage();
