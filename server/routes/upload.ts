import { Router } from 'express';
import multer from 'multer';
import { storageService } from '../services/storage';
import { db } from '../db';
import { flashcardSets } from '../../db/schema/flashcards';
import { eq } from 'drizzle-orm';

const router = Router();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Handle file upload and create flashcard set
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, description } = req.body;
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Generate a unique filename with user ID and timestamp
    const timestamp = Date.now();
    const fileExtension = req.file.originalname.split('.').pop();
    const storedFileName = `user_${req.session.userId}_${timestamp}.${fileExtension}`;

    // Upload file to Object Storage
    await storageService.uploadFile(
      req.file.buffer,
      storedFileName
    );

    // Create flashcard set with file reference
    const [flashcardSet] = await db
      .insert(flashcardSets)
      .values({
        userId: req.session.userId,
        title: title || req.file.originalname,
        description,
        filePath: storedFileName,
      })
      .returning();

    // Get signed URL for immediate use
    const fileUrl = await storageService.getFileUrl(storedFileName);

    res.status(201).json({
      ...flashcardSet,
      fileUrl
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up any uploaded file if database operation failed
    if (error && storedFileName) {
      try {
        await storageService.deleteFile(storedFileName);
      } catch (cleanupError) {
        console.error('Failed to cleanup file after error:', cleanupError);
      }
    }

    res.status(500).json({ 
      error: 'Failed to process upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get file URL for a flashcard set
router.get('/:setId/file', async (req, res) => {
  try {
    const setId = parseInt(req.params.setId);
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const flashcardSet = await db.query.flashcardSets.findFirst({
      where: eq(flashcardSets.id, setId)
    });

    if (!flashcardSet || !flashcardSet.filePath) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileUrl = await storageService.getFileUrl(flashcardSet.filePath);
    res.json({ fileUrl });
  } catch (error) {
    console.error('Error getting file URL:', error);
    res.status(500).json({ error: 'Failed to get file URL' });
  }
});

export default router;
