import { auth } from './firebase';
import type { Request, Response, NextFunction } from 'express';

// Firebase authentication middleware
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Optional auth middleware is now handled in security.ts
export { optionalAuth } from '../middleware/security';