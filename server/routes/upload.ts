import { Router } from 'express';
import multer from 'multer';
import { storage } from '../lib/storage';
import { db } from '../db';
import { flashcardSets, flashcards } from '@db/schema/flashcards';
import { users } from '@db/schema/users';
import { eq } from 'drizzle-orm';
import { Request } from 'express';
import { Session } from 'express-session';
import { parse } from 'csv-parse';

interface AuthenticatedRequest extends Request {
  session: Session & {
    user?: {
      id: number;
      email?: string;
      isAdmin?: boolean;
    };
    authenticated?: boolean;
  };
}

const router = Router();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      cb(new Error('Only CSV files are allowed'));
      return;
    }
    cb(null, true);
  }
});

// Handle file upload and create flashcard set
router.post('/', upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.session?.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Parse CSV file
    const csvContent = req.file.buffer.toString('utf-8');
    const cards = await new Promise<any[]>((resolve, reject) => {
      parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
      .on('data', (data) => resolve([data]))
      .on('error', (error) => reject(error));
    });

    // Validate required columns
    const requiredColumns = ['Vocab Word', 'Identifying Part Of Speach', 'Definition', 'Example Sentance'];
    const missingColumns = requiredColumns.filter(col => !cards[0] || !(col in cards[0]));
    
    if (missingColumns.length > 0) {
      return res.status(400).json({ 
        error: `Missing required columns: ${missingColumns.join(', ')}`
      });
    }

    // Create unique file path for Object Storage
    const timestamp = Date.now();
    const sanitizedFilename = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `flashcards/${req.session.user.id}/${timestamp}_${sanitizedFilename}`;

    // Upload to Object Storage
    console.log('Uploading to Object Storage:', {
      path: filePath,
      size: req.file.buffer.length,
      timestamp: new Date().toISOString()
    });

    const uploadResult = await storage.uploadFile(filePath, req.file.buffer);
    if (uploadResult.error) {
      throw new Error(`Storage upload failed: ${uploadResult.error}`);
    }

    // Create flashcard set
    const [newSet] = await db.insert(flashcardSets).values({
      userId: req.session.user.id,
      title: req.file.originalname.replace(/\.[^/.]+$/, ""),
      isPublic: false,
      tags: '{}', // Empty PostgreSQL array
      urlPath: `sets/${timestamp}`,
      filePath: filePath,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    try {
      // Map cards data to schema
      const cardValues = cards.map((card, index) => ({
        setId: newSet.id,
        vocabWord: card['Vocab Word'],
        partOfSpeech: card['Identifying Part Of Speach'],
        definition: card['Definition'],
        exampleSentence: card['Example Sentance'],
        position: index + 1
      }));

      // Insert flashcards
      await db.insert(flashcards).values(cardValues);

      // Generate download URL for immediate access
      const downloadResult = await storage.downloadFile(filePath);
      
      res.status(201).json({
        message: 'File uploaded successfully',
        flashcardSet: {
          id: newSet.id,
          title: newSet.title,
          filePath: filePath,
          urlPath: newSet.urlPath,
          downloadUrl: downloadResult.presignedUrl,
          createdAt: newSet.createdAt
        }
      });
    } catch (error) {
      // Cleanup on failure
      await storage.deleteFile(filePath).catch(err => 
        console.error('Cleanup error:', err)
      );
      throw error;
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to process upload'
    });
  }
});

export default router;