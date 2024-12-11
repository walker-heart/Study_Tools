import type { Request, Response, NextFunction } from "express";
import rateLimit from 'express-rate-limit';
import { env } from '../lib/env';
import { log } from '../lib/log';

// Rate limiting configuration for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for auth endpoints
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => env.NODE_ENV === 'development',
  handler: (req: Request, res: Response) => {
    log({
      message: 'Rate limit exceeded for auth endpoint',
      path: req.path,
      method: req.method,
      ip: req.ip,
      realIP: req.headers['x-real-ip'],
      forwardedFor: req.headers['x-forwarded-for']
    }, 'warn');
    res.status(429).json({ 
      error: 'Too many attempts',
      message: 'Please try again later',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

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
  // Regenerate session ID on login
  if (req.path === '/api/auth/signin' && req.method === 'POST') {
    req.session.regenerate((err) => {
      if (err) {
        log({
          message: 'Failed to regenerate session',
          path: req.path,
          method: req.method,
          stack: err.stack
        }, 'error');
      }
      next();
    });
    return;
  }

  // Check for session fixation
  const currentSessionID = req.sessionID;
  if (req.session?.user && currentSessionID !== req.session.originalID) {
    req.session.regenerate((err) => {
      if (err) {
        log({
          message: 'Session fixation attempt detected',
          path: req.path,
          method: req.method,
          stack: err.stack
        }, 'warn');
        req.session.destroy(() => {
          res.status(401).json({ message: 'Session invalid' });
        });
        return;
      }
      next();
    });
    return;
  }

  next();
}
