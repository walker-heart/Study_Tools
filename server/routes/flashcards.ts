import { Router, Request } from 'express';
import { eq } from 'drizzle-orm';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import { db, query } from '@db/index';
import { flashcardSets, flashcards, memorizationSessions } from '@db/schema/flashcards';
import type { FlashcardSet, Flashcard, MemorizationSession } from '@db/index';
import { storage } from '../lib/storage';

// Extend Express Request type to include user
interface AuthenticatedRequest extends Request {
  session: {
    user?: {
      id: number;
      email: string;
      isAdmin?: boolean;
    };
    authenticated?: boolean;
  };
}

const router = Router();
const upload = multer();
// Handle file upload for flashcard sets
router.post('/sets/upload', upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Upload file to storage
    const fileBuffer = req.file.buffer;
    const fileName = `flashcards/${userId}/${Date.now()}-${req.file.originalname}`;
    const uploadResult = await storage.uploadFile(fileName, fileBuffer);

    if (uploadResult.error) {
      throw new Error(uploadResult.error);
    }

    // Store file reference in database
    const [flashcardSet] = await db.insert(flashcardSets).values({
      userId,
      title: req.file.originalname,
      filePath: fileName,
      isPublic: false,
      tags: []
    }).returning();

    res.status(201).json({ 
      message: 'File uploaded successfully',
      flashcardSet
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to upload file' });
  }
});

// Create a new flashcard set
router.post('/sets', 
  body('title').notEmpty().trim(),
  body('description').optional().trim(),
  body('isPublic').optional().isBoolean(),
  body('tags').optional().isArray(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description, isPublic, tags } = req.body;
      const userId = req.session.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const [newSet] = await db.insert(flashcardSets).values({
        userId,
        title,
        description,
        isPublic: isPublic || false,
        tags: tags || []
      }).returning();

      res.status(201).json(newSet);
    } catch (error) {
      console.error('Error creating flashcard set:', error);
      res.status(500).json({ error: 'Failed to create flashcard set' });
    }
});

// Add flashcards to a set
router.post('/sets/:setId/cards',
  body('cards').isArray(),
  body('cards.*.vocabWord').notEmpty().trim(),
  body('cards.*.partOfSpeech').notEmpty().trim(),
  body('cards.*.definition').notEmpty().trim(),
  body('cards.*.exampleSentence').optional().trim(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { setId } = req.params;
      const { cards } = req.body;
      const userId = req.session.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Verify set ownership
      const set = await query.flashcardSets.findWithCards(parseInt(setId));

      if (!set || set.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Insert all cards with positions
      const cardValues = cards.map((card: {
        vocabWord: string;
        partOfSpeech: string;
        definition: string;
        exampleSentence?: string;
      }, index: number) => ({
        setId: parseInt(setId),
        vocabWord: card.vocabWord,
        partOfSpeech: card.partOfSpeech,
        definition: card.definition,
        exampleSentence: card.exampleSentence,
        position: index + 1
      }));

      const newCards = await db.insert(flashcards).values(cardValues).returning();
      res.status(201).json(newCards);
    } catch (error) {
      console.error('Error adding flashcards:', error);
      res.status(500).json({ error: 'Failed to add flashcards' });
    }
});

// Start a memorization session
router.post('/sets/:setId/memorize', async (req: AuthenticatedRequest, res) => {
  try {
    const { setId } = req.params;
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all cards in the set
    const cards = await query.flashcards.findBySet(parseInt(setId));

    if (!cards.length) {
      return res.status(404).json({ error: 'No cards found in this set' });
    }

    // Create new memorization session
    const [session] = await db.insert(memorizationSessions).values({
      userId,
      setId: parseInt(setId),
      progress: {
        completed: [],
        incorrect: [],
        remainingCards: cards.map((card: { id: number }) => card.id)
      }
    }).returning();

    res.status(201).json(session);
  } catch (error) {
    console.error('Error starting memorization session:', error);
    res.status(500).json({ error: 'Failed to start memorization session' });
  }
});

// Update memorization session progress
router.put('/memorize/:sessionId', 
  body('cardId').isInt(),
  body('correct').isBoolean(),
  async (req: AuthenticatedRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { sessionId } = req.params;
      const { cardId, correct } = req.body;
      const userId = req.session.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get current session
      const session = await db.query.memorizationSessions.findFirst({
        where: eq(memorizationSessions.id, parseInt(sessionId)),
        columns: {
          id: true,
          userId: true,
          progress: true
        }
      });

      if (!session || session.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const progress = session.progress;
      const remainingCards = progress.remainingCards.filter((id: number) => id !== cardId);
      
      if (correct) {
        progress.completed.push(cardId);
      } else {
        progress.incorrect.push(cardId);
        remainingCards.push(cardId);
      }

      // Update session
      const [updatedSession] = await db.update(memorizationSessions)
        .set({
          progress: {
            ...progress,
            remainingCards
          },
          completedAt: remainingCards.length === 0 ? new Date() : null,
          score: (progress.completed.length / (progress.completed.length + progress.incorrect.length)) * 100
        })
        .where(eq(memorizationSessions.id, parseInt(sessionId)))
        .returning();

      res.json(updatedSession);
    } catch (error) {
      console.error('Error updating memorization session:', error);
      res.status(500).json({ error: 'Failed to update memorization session' });
    }
});

export default router;
