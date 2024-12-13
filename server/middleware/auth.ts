import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '../lib/errorTracking';
import { auth } from 'firebase-admin';

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
    const decodedToken = await auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
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
    const decodedToken = await auth().verifyIdToken(token);
    
    if (!decodedToken.admin) {
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
    return res.status(401).json({ 
      message: 'Authentication required',
      error: 'Invalid authentication token'
    });
  }
}
