import type { Request, Response, NextFunction } from "express";
import rateLimit from 'express-rate-limit';
import { env } from '../lib/env';
import { log } from '../lib/log';
import { AuthenticationError, trackError } from '../lib/errorTracking';
import { auth } from '../config/firebase';

// Firebase session validation middleware
export async function validateFirebaseSession(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      // Firebase Admin SDK will handle token verification
      const decodedToken = await auth.verifyIdToken(idToken);
      req.user = decodedToken;
    }
  } catch (error) {
    console.error('Firebase session validation error:', error);
  }
  next();
}

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

// Firebase auth security middleware
export function sessionSecurity(req: Request, res: Response, next: NextFunction) {
  // Skip security checks for non-auth routes
  if (!req.path.startsWith('/api/auth/')) {
    return next();
  }

  // Check admin access
  if (req.path.startsWith('/api/admin/')) {
    if (!req.user?.admin) {
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

  next();
}
