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

    // Validate file type
    if (!req.file.originalname.toLowerCase().endsWith('.csv')) {
      return res.status(400).json({ error: 'Invalid file type. Only CSV files are allowed.' });
    }

    // Validate file size (5MB limit)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'File size exceeds 5MB limit.' });
    }

    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Create flashcard set first to get the setId
    const [flashcardSet] = await db.insert(flashcardSets).values({
      userId,
      title: req.file.originalname.replace(/\.[^/.]+$/, ""), // Remove file extension
      isPublic: false,
      tags: [], // PostgreSQL array
      createdAt: new Date(),
      updatedAt: new Date(),
      filePath: null // Will be updated after successful upload
    }).returning();

    try {
      // Create a unique file path for storage
      const fileName = `flashcards/${userId}/${flashcardSet.id}/${req.file.originalname}`;
      
      // Upload file using storage service
      const uploadResult = await storage.upload(fileName, req.file.buffer);
      
      if (uploadResult.error) {
        throw new Error(uploadResult.error);
      }

      // Update the set with the file path after successful upload
      const [updatedSet] = await db.update(flashcardSets)
        .set({ 
          filePath: fileName,
          updatedAt: new Date()
        })
        .where(eq(flashcardSets.id, flashcardSet.id))
        .returning();

      if (!updatedSet) {
        throw new Error('Failed to update flashcard set with file path');
      }

      res.status(201).json({ 
        message: 'File uploaded successfully',
        flashcardSet: updatedSet
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      
      // Cleanup the created set if upload fails
      if (flashcardSet?.id) {
        await db.delete(flashcardSets)
          .where(eq(flashcardSets.id, flashcardSet.id))
          .catch(err => console.error('Cleanup error:', err));
      }
      
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to upload file'
      });
    }
  } catch (error) {
    console.error('Error handling upload:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to process upload'
    });
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
        tags: tags ? `{${tags.map(t => `"${t}"`).join(',')}}` : '{}',
        createdAt: new Date(),
        updatedAt: new Date()
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

// Get user's uploaded files
router.get('/sets/files', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userPrefix = `flashcards/${userId}/`;
    const filesResult = await storage.list(userPrefix);
    
    if (filesResult.error) {
      throw new Error(filesResult.error);
    }

    // Get all flashcard sets for the user
    const sets = await db.query.flashcardSets.findMany({
      where: eq(flashcardSets.userId, userId),
      orderBy: [flashcardSets.createdAt],
    });

    const filesWithMetadata = sets.map(set => ({
      ...set,
      downloadUrl: null as string | null
    }));

    // Get download URLs for all files
    for (const file of filesWithMetadata) {
      if (file.filePath) {
        const downloadResult = await storage.download(file.filePath);
        if (downloadResult.presignedUrl) {
          file.downloadUrl = downloadResult.presignedUrl;
        }
      }
    }

    res.json(filesWithMetadata);
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list files' });
  }
});

// Download a specific file
router.get('/sets/:setId/download', async (req: AuthenticatedRequest, res) => {
  try {
    const { setId } = req.params;
    const userId = req.session.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the flashcard set
    const set = await db.query.flashcardSets.findFirst({
      where: eq(flashcardSets.id, parseInt(setId)),
    });

    if (!set || set.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!set.filePath) {
      return res.status(404).json({ error: 'No file associated with this set' });
    }

    const downloadResult = await storage.downloadFile(set.filePath);
    
    if (downloadResult.error) {
      throw new Error(downloadResult.error);
    }

    if (!downloadResult.presignedUrl) {
      throw new Error('Failed to generate download URL');
    }

    res.json({ downloadUrl: downloadResult.presignedUrl });
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to download file' });
  }
});

export default router;