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
  let createdSetId: number | null = null;
  let uploadedFilePath: string | null = null;

  console.log('Processing file upload:', {
    filename: req.file?.originalname,
    size: req.file?.size,
    timestamp: new Date().toISOString()
  });

  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate user authentication
    if (!req.session?.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Parse CSV file
    const csvContent = req.file.buffer.toString('utf-8');
    const cards = await new Promise<any[]>((resolve, reject) => {
      const results: any[] = [];
      parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
      .on('data', (data) => results.push(data))
      .on('error', (error) => reject(error))
      .on('end', () => resolve(results));
    });

    // Validate CSV structure
    if (!cards.length) {
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Validate required columns
    const requiredColumns = ['Vocab Word', 'Identifying Part Of Speach', 'Definition', 'Example Sentance'];
    const missingColumns = requiredColumns.filter(col => !cards[0] || !(col in cards[0]));
    
    if (missingColumns.length > 0) {
      return res.status(400).json({ 
        error: `Missing required columns: ${missingColumns.join(', ')}`
      });
    }

    // Create unique file path
    const timestamp = Date.now();
    const sanitizedFilename = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `flashcards/${req.session.user.id}/${timestamp}_${sanitizedFilename}`;

    // Upload file to storage
    console.log('Uploading to storage:', {
      path: filePath,
      size: req.file.buffer.length,
      timestamp: new Date().toISOString()
    });

    const uploadResult = await storage.upload(filePath, req.file.buffer);
    if (!uploadResult.success) {
      throw new Error(`Storage upload failed: ${uploadResult.error}`);
    }
    uploadedFilePath = filePath;

    // Create flashcard set
    const setValues = {
      userId: req.session.user.id,
      title: req.file.originalname.replace(/\.[^/.]+$/, ""),
      isPublic: false,
      tags: [] as string[],
      urlPath: `sets/${timestamp}`,
      filePath: filePath,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('Creating flashcard set:', {
      userId: req.session.user.id,
      timestamp: timestamp,
      fileName: req.file.originalname
    });

    const [newSet] = await db.insert(flashcardSets)
      .values(setValues)
      .returning();

    if (!newSet?.id) {
      throw new Error('Failed to create flashcard set');
    }
    createdSetId = newSet.id;

    // Insert flashcards
    console.log('Processing flashcards:', {
      setId: newSet.id,
      cardsCount: cards.length
    });

    const cardValues = cards.map((card, index) => ({
      setId: newSet.id,
      vocabWord: card['Vocab Word'].trim(),
      partOfSpeech: card['Identifying Part Of Speach'].trim(),
      definition: card['Definition'].trim(),
      exampleSentence: card['Example Sentance']?.trim(),
      position: index + 1
    }));

    await db.insert(flashcards).values(cardValues);

    // Generate download URL
    const downloadResult = await storage.download(filePath);
    if (!downloadResult.success) {
      throw new Error('Failed to generate download URL');
    }

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
    console.error('Upload error:', error);

    // Cleanup on failure
    if (uploadedFilePath) {
      await storage.delete(uploadedFilePath).catch(err => 
        console.error('File cleanup error:', err)
      );
    }

    if (createdSetId) {
      await db.delete(flashcardSets)
        .where(eq(flashcardSets.id, createdSetId))
        .execute()
        .catch(err => console.error('Database cleanup error:', err));
    }

    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to process upload'
    });
  }
});

export default router;
