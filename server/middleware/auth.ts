import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '../lib/errorTracking';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.authenticated) {
    return res.status(401).json({ 
      message: 'Authentication required',
      error: 'Please sign in to continue'
    });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.authenticated) {
    return res.status(401).json({ 
      message: 'Authentication required',
      error: 'Please sign in to continue'
    });
  }

  if (!req.session?.user?.isAdmin) {
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

  next();
}
