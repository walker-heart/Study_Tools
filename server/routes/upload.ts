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

    // Create URL path: firstname-lastname/set-id (URL safe format)
    const urlPath = `${user.firstName.toLowerCase()}-${user.lastName.toLowerCase()}/set-${nextId}`;

    // Create flashcard set in database
    const [newSet] = await db.insert(flashcardSets).values({
      userId: req.session.user.id,
      title: req.file.originalname.replace(/\.[^/.]+$/, ""), // Remove file extension
      isPublic: false,
      tags: [],
      urlPath,
      filePath: null // Will be updated after storage upload
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

    // Create unique file path
    const filePath = `flashcards/${req.session.user.id}/${newSet.id}/${req.file.originalname}`;
    
    // Upload file to storage
    console.log('Attempting to upload file:', { filePath, fileSize: req.file.buffer.length });
    const uploadResult = await storage.uploadFile(filePath, req.file.buffer);
    console.log('Upload result:', uploadResult);
    
    if (uploadResult.error) {
      console.error('File upload failed:', uploadResult.error);
      // Cleanup the database entry if file upload fails
      await db.delete(flashcardSets).where(eq(flashcardSets.id, newSet.id));
      throw new Error(uploadResult.error);
    }

    console.log('File uploaded successfully, updating database record');
    // Update set with file path
    const [updatedSet] = await db.update(flashcardSets)
      .set({ filePath })
      .where(eq(flashcardSets.id, newSet.id))
      .returning();
    
    console.log('Database record updated:', updatedSet);

    // Insert flashcards
    await db.insert(flashcards).values(cardValues);

    await db.insert(flashcards).values(cardValues);

    // Prepare the response to match client expectations
    res.status(201).json({
      message: 'File uploaded successfully',
      flashcardSet: {
        id: newSet.id,
        title: newSet.title,
        filePath: filePath,
        urlPath: urlPath,
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