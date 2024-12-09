import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandling';
import type { Request } from 'express';

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

router.get('/protected', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.session.authenticated) {
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }
  
  res.json({ message: 'Protected route accessed successfully' });
}));

export default router;
