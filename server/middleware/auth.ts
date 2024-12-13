import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { AuthenticationError } from '../lib/errorTracking';
import { auth, firestore } from '../lib/firebase-admin';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: DecodedIdToken;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'Authentication required',
        error: 'Missing or invalid authentication token'
      });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ 
      message: 'Authentication required',
      error: 'Invalid authentication token'
    });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'Authentication required',
        error: 'Missing or invalid authentication token'
      });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    
    // Check if user exists in Firestore and has admin role
    const userDoc = await firestore.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    if (!userDoc.exists || !userData?.isAdmin) {
      const error = new AuthenticationError('Unauthorized admin access attempt', {
        path: req.path,
        method: req.method,
        statusCode: 403
      });
      return res.status(403).json({
        message: 'Access denied',
        error: 'Administrator privileges required',
        details: 'Please contact your system administrator if you need access'
      });
    }

    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    return res.status(401).json({ 
      message: 'Authentication required',
      error: 'Invalid authentication token'
    });
  }
}
