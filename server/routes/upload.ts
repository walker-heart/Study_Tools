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

    // Get user information
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.session.user.id)
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create flashcard set first to get the ID
    const [newSet] = await db.insert(flashcardSets).values({
      userId: req.session.user.id,
      title: req.file.originalname.replace(/\.[^/.]+$/, ""),
      isPublic: false,
      tags: [],
      urlPath: `${user.firstName.toLowerCase()}-${user.lastName.toLowerCase()}/set-${Date.now()}`,
      filePath: null, // Will be updated after storage upload
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    // Create unique file path for Object Storage
    const filePath = `flashcards/${req.session.user.id}/${newSet.id}/${req.file.originalname}`;

    // Upload to Replit Object Storage
    console.log('Uploading to Object Storage:', {
      path: filePath,
      size: req.file.buffer.length,
      timestamp: new Date().toISOString()
    });

    const uploadResult = await storage.uploadFile(filePath, req.file.buffer);
    if (uploadResult.error) {
      // If upload fails, delete the flashcard set and return error
      await db.delete(flashcardSets).where(eq(flashcardSets.id, newSet.id));
      throw new Error(`Storage upload failed: ${uploadResult.error}`);
    }

    // Update flashcard set with file path
    const [updatedSet] = await db.update(flashcardSets)
      .set({ 
        filePath,
        updatedAt: new Date()
      })
      .where(eq(flashcardSets.id, newSet.id))
      .returning();

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

    res.status(201).json({
      message: 'File uploaded successfully',
      flashcardSet: {
        id: updatedSet.id,
        title: updatedSet.title,
        filePath: updatedSet.filePath,
        urlPath: updatedSet.urlPath,
        createdAt: updatedSet.createdAt
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
