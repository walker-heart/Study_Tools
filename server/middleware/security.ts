import type { Request, Response, NextFunction } from "express";
import rateLimit from 'express-rate-limit';
import { env } from '../lib/env';
import { log } from '../lib/log';

// Note: Auth-specific rate limiting removed as it was causing unnecessary friction
// We now rely on general rate limiting and other security measures

// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Set security headers
  const headers = {
    'X-XSS-Protection': '1; mode=block',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': [
      "default-src 'self'",
      "img-src 'self' data: https: blob:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "connect-src 'self' https://api.openai.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
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
        log({
          message: 'Failed to regenerate session',
          path: req.path,
          method: req.method,
          stack: err.stack
        }, 'error');
        return res.status(500).json({ message: 'Session error' });
      }
      
      // Restore user data to new session
      req.session.user = originalUser;
      next();
    });
    return;
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
