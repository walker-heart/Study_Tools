import { Router } from 'express';
import multer from 'multer';
import { storage } from '../lib/storage';
import { db } from '../db';
import { flashcardSets, flashcards } from '@db/schema/flashcards';
import { users } from '@db/schema/users';
import { eq, desc } from 'drizzle-orm';
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

// Configure multer for memory storage with proper file type validation
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
      const results: any[] = [];
      parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
      .on('data', (data: any) => results.push(data))
      .on('error', (error: Error) => reject(error))
      .on('end', () => resolve(results));
    });

    // Validate required columns
    const requiredColumns = ['Vocab Word', 'Identifying Part Of Speach', 'Definition', 'Example Sentance'];
    const missingColumns = requiredColumns.filter(col => !cards[0] || !(col in cards[0]));
    
    if (missingColumns.length > 0) {
      return res.status(400).json({ 
        error: `Missing required columns: ${missingColumns.join(', ')}`
      });
    }

    // Get user information for URL path
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.session.user.id)
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get the next ID for the set
    const lastSet = await db.query.flashcardSets.findFirst({
      orderBy: [desc(flashcardSets.id)],
    });
    const nextId = (lastSet?.id || 0) + 1;

    // Create unique file path for Replit Object Storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeFilename = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `flashcards/${req.session.user.id}/${timestamp}_${safeFilename}`;

    // Upload to Replit Object Storage first
    console.log('Uploading file to Object Storage:', {
      path: filePath,
      size: req.file.buffer.length,
      type: req.file.mimetype
    });

    const uploadResult = await storage.uploadFile(filePath, req.file.buffer);
    if (uploadResult.error) {
      throw new Error(`Storage upload failed: ${uploadResult.error}`);
    }

    // Create flashcard set in database after successful upload
    const [newSet] = await db.insert(flashcardSets).values({
      userId: req.session.user.id,
      title: req.file.originalname.replace(/\.[^/.]+$/, ""),
      isPublic: false,
      tags: [], 
      urlPath: `${user.firstName.toLowerCase()}-${user.lastName.toLowerCase()}/set-${nextId}`,
      filePath, // Store the Object Storage path
      createdAt: new Date()
    }).returning();

    // Map cards data to match schema
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

    // Prepare the response
    res.status(201).json({
      message: 'File uploaded successfully',
      flashcardSet: {
        id: newSet.id,
        title: newSet.title,
        filePath: filePath,
        urlPath: newSet.urlPath,
        createdAt: newSet.createdAt
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to process upload'
    });
  }
});

export default router;
