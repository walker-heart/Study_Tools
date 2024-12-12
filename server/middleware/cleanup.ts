import { Request, Response, NextFunction } from 'express';
import { debug } from '../lib/logging';

const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes
let lastCleanup = Date.now();

export function cleanupSessions(req: Request, _res: Response, next: NextFunction) {
  const now = Date.now();
  
  // Only run cleanup periodically
  if (now - lastCleanup >= CLEANUP_INTERVAL) {
    if (req.sessionStore && typeof req.sessionStore.all === 'function') {
      req.sessionStore.all((err, sessions) => {
        if (err) {
          debug({
            message: 'Session cleanup error',
            error: err.message
          });
          return next();
        }

        if (sessions) {
          const expired = Object.keys(sessions).filter(sid => {
            const session = sessions[sid];
            return session && session.cookie && session.cookie.expires && 
                   new Date(session.cookie.expires) < new Date();
          });

          expired.forEach(sid => {
            req.sessionStore!.destroy(sid, (err) => {
              if (err) {
                debug({
                  message: 'Error destroying expired session',
                  sessionId: sid,
                  error: err.message
                });
              }
            });
          });

          debug({
            message: 'Session cleanup completed',
            expired_count: expired.length,
            total_sessions: Object.keys(sessions).length
          });
        }
      });
    }
    lastCleanup = now;
  }
  next();
}
