import { auth } from './firebase';
import type { Request, Response, NextFunction } from 'express';

// Firebase authentication middleware
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Optional auth middleware that doesn't require authentication but adds user if token is present
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await auth.verifyIdToken(idToken);
      req.user = decodedToken;
    }
  } catch (error) {
    console.error('Optional auth error:', error);
  }
  next();
}