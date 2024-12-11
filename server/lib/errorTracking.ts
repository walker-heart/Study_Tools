import { Request, Response } from 'express';
import { log } from './log';
import { randomUUID } from 'crypto';

export interface ErrorContext {
  requestId?: string;
  userId?: string | number;
  path?: string;
  method?: string;
  statusCode?: number;
  errorCode?: string;
  timestamp?: Date;
  stack?: string;
  additionalInfo?: Record<string, any>;
}

export class AppError extends Error {
  public context: ErrorContext;
  
  constructor(message: string, context: Partial<ErrorContext> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = {
      ...context,
      timestamp: new Date(),
      errorCode: context.errorCode || 'UNKNOWN_ERROR'
    };
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, context: Partial<ErrorContext> = {}) {
    super(message, { ...context, errorCode: 'AUTH_ERROR' });
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context: Partial<ErrorContext> = {}) {
    super(message, { ...context, errorCode: 'VALIDATION_ERROR' });
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, context: Partial<ErrorContext> = {}) {
    super(message, { ...context, errorCode: 'DB_ERROR' });
    this.name = 'DatabaseError';
  }
}

export function trackError(error: Error | AppError, req?: Request, res?: Response) {
  const context: ErrorContext = {
    requestId: req?.headers['x-request-id'] as string || randomUUID(),
    userId: req?.session?.user?.id,
    path: req?.path,
    method: req?.method,
    statusCode: res?.statusCode,
    timestamp: new Date(),
    stack: error.stack
  };

  if ('context' in error) {
    Object.assign(context, (error as AppError).context);
  }

  const logMessage: LogMessage = {
    message: error.message,
    errorCode: 'context' in error ? error.context.errorCode : 'UNKNOWN_ERROR',
    level: 'error',
    metadata: {
      errorName: error.name,
      errorType: error.constructor.name,
      ...context
    }
  };
  
  log(logMessage, 'error');

  return context;
}

export function initRequestTracking() {
  return (req: Request, _res: Response, next: Function) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || randomUUID();
    next();
  };
}
