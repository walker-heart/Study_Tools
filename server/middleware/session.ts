import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export function sessionSecurity(req: Request, res: Response, next: NextFunction) {
  // Ensure session object exists
  if (!req.session) {
    return next(new Error('Session middleware not properly initialized'));
  }

  // Regenerate session ID periodically
  if (req.session.lastRotated) {
    const lastRotated = new Date(req.session.lastRotated);
    const now = new Date();
    const hoursSinceRotation = (now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceRotation >= 24) { // Rotate every 24 hours
      req.session.regenerate((err: Error | null) => {
        if (err) {
          return next(err);
        }
        req.session.lastRotated = now;
        next();
      });
      return;
    }
  } else {
    req.session.lastRotated = new Date();
  }

  // Set secure headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  if (env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}
