import type { Request, Response, NextFunction } from "express";
import rateLimit from 'express-rate-limit';
import { env } from '../lib/env';
import { log } from '../lib/log';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { AuthenticationError, trackError } from '../lib/errorTracking';

// Session cleanup middleware
export async function cleanupSessions(req: Request, _res: Response, next: NextFunction) {
  try {
    // Only run cleanup periodically (e.g., every 100 requests)
    if (Math.random() < 0.01) {
      await db.execute(sql`
        UPDATE user_sessions 
        SET ended_at = NOW() 
        WHERE ended_at IS NULL 
        AND created_at < NOW() - INTERVAL '24 hours'`);
    }
  } catch (error) {
    console.error('Session cleanup error:', error);
  }
  next();
}

// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Skip security headers for OAuth callback
  if (req.path.startsWith('/api/auth/google')) {
    return next();
  }

  // Set security headers
  const headers = {
    'X-XSS-Protection': '1; mode=block',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': [
      "default-src 'self' https://*.wtoolsw.com",
      "img-src 'self' data: https: blob: *.googleusercontent.com https://*.wtoolsw.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://*.wtoolsw.com",
      "style-src 'self' 'unsafe-inline' https://accounts.google.com https://*.wtoolsw.com",
      "font-src 'self' data: https://fonts.gstatic.com https://*.wtoolsw.com",
      "connect-src 'self' https://api.openai.com https://accounts.google.com https://*.wtoolsw.com wss: ws:",
      "frame-src 'self' https://accounts.google.com https://*.wtoolsw.com",
      "frame-ancestors 'self' https://*.wtoolsw.com",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com https://*.wtoolsw.com"
    ].join('; '),
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };

  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Remove unnecessary headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
}

// Parameter pollution prevention
export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  const cleanObject = (obj: any): any => {
    const cleaned: any = {};
    
    Object.keys(obj).forEach(key => {
      // Convert arrays with single item to that item
      if (Array.isArray(obj[key]) && obj[key].length === 1) {
        cleaned[key] = obj[key][0];
      }
      // Keep only the first occurrence for arrays
      else if (Array.isArray(obj[key])) {
        cleaned[key] = obj[key][0];
      }
      // Recursively clean nested objects
      else if (obj[key] && typeof obj[key] === 'object') {
        cleaned[key] = cleanObject(obj[key]);
      }
      // Keep primitive values as is
      else {
        cleaned[key] = obj[key];
      }
    });

    return cleaned;
  };

  if (req.query) {
    req.query = cleanObject(req.query);
  }
  if (req.body) {
    req.body = cleanObject(req.body);
  }

  next();
}

// Session security middleware
export function sessionSecurity(req: Request, res: Response, next: NextFunction) {
  // Skip session security for non-auth routes
  if (!req.path.startsWith('/api/auth/')) {
    return next();
  }

  // Ensure session exists
  if (!req.session) {
    log({
      message: 'No session found',
      path: req.path,
      method: req.method
    }, 'warn');
    return res.status(500).json({ message: 'Session initialization failed' });
  }

  // Handle login requests
  if (req.path === '/api/auth/signin' && req.method === 'POST') {
    // Store original session data
    const originalUser = req.session.user;
    
    // Regenerate session
    req.session.regenerate((err: Error | null) => {
      if (err) {
        const error = new AuthenticationError('Failed to regenerate session', {
          path: req.path,
          method: req.method,
          statusCode: 500
        });
        trackError(error, req);
        return res.status(500).json({ 
          message: 'Session error occurred',
          error: 'Please try again',
          requestId: req.headers['x-request-id']
        });
      }
      
      // Restore user data to new session
      req.session.user = originalUser;
      next();
    });
    return;
  }

  // Check admin access
  if (req.path.startsWith('/api/admin/')) {
    if (!req.session?.user?.isAdmin) {
      const error = new AuthenticationError('Unauthorized admin access attempt', {
        path: req.path,
        method: req.method,
        statusCode: 403,
        errorCode: 'ADMIN_ACCESS_DENIED'
      });
      const context = trackError(error, req);
      return res.status(403).json({
        message: 'Access denied',
        error: 'Administrator privileges required for this action',
        details: 'Please contact your system administrator if you need access',
        requestId: context.requestId,
        code: 'ADMIN_ACCESS_DENIED'
      });
    }
  }

  // Check for session fixation on authenticated routes
  if (req.session.user) {
    const currentSessionID = req.sessionID;
    const originalID = req.session.originalID;
    
    if (originalID && currentSessionID !== originalID) {
      log({
        message: 'Session fixation attempt detected',
        path: req.path,
        method: req.method
      }, 'warn');
      
      req.session.destroy((err: Error | null) => {
        if (err) {
          log({
            message: 'Error destroying suspicious session',
            path: req.path,
            method: req.method,
            stack: err.stack
          }, 'error');
        }
        res.status(401).json({ message: 'Session invalid' });
      });
      return;
    }
  }

  next();
}
