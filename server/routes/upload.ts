import { Router } from 'express';
import multer from 'multer';
import { storageService } from '../services/storage';
import { db } from '../db';
import { flashcardSets } from '../../db/schema/flashcards';
import { eq } from 'drizzle-orm';
import { Request } from 'express';

import { Session } from 'express-session';

interface AuthenticatedRequest extends Request {
  session: Session & {
    user?: {
      id: number;
    };
  };
}

const router = Router();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Handle file upload and create flashcard set
router.post('/', upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title } = req.body;
    if (!req.session?.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Parse CSV file
    const csvContent = req.file.buffer.toString('utf-8');
    const cards = await new Promise<any[]>((resolve, reject) => {
      const results: any[] = [];
      require('csv-parse').parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
      .on('data', (data: any) => results.push(data))
      .on('error', (error: Error) => reject(error))
      .on('end', () => resolve(results));
    });

    // Create flashcard set object with simplified structure
    const flashcardSet = {
      id: Date.now(), // Use timestamp as temporary ID
      userId: req.session.user.id,
      title: title || req.file.originalname,
      cards: cards.map(card => ({
        text: card['Text'],
        createdAt: new Date().toISOString()
      })),
      createdAt: new Date().toISOString()
    };

    // Save flashcard set to file storage
    await storageService.saveFlashcardSet(flashcardSet.id, flashcardSet);

    res.status(201).json({
      id: flashcardSet.id,
      title: flashcardSet.title,
      createdAt: flashcardSet.createdAt,
      cardCount: flashcardSet.cards.length
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get flashcard set data
router.get('/:setId', async (req: AuthenticatedRequest, res) => {
  try {
    const setId = parseInt(req.params.setId);
    if (!req.session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const flashcardSet = await storageService.getFlashcardSet(setId);
    
    if (flashcardSet.userId !== req.session.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(flashcardSet);
  } catch (error) {
    console.error('Error getting flashcard set:', error);
    res.status(500).json({ error: 'Failed to get flashcard set' });
  }
});

// List all flashcard sets for user
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const setIds = await storageService.listFlashcardSets(req.session.user.id);
    const sets = await Promise.all(
      setIds.map(id => storageService.getFlashcardSet(id))
    );

    res.json(sets.map(set => ({
      id: set.id,
      title: set.title,
      createdAt: set.createdAt,
      cardCount: set.cards.length
    })));
  } catch (error) {
    console.error('Error listing flashcard sets:', error);
    res.status(500).json({ error: 'Failed to list flashcard sets' });
  }
});

export default router;
