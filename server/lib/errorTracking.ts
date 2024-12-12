import { Request, Response, NextFunction } from 'express';
import { log, LogMessage } from './log';
import { randomUUID } from 'crypto';

// Define TypedRequest interface here as it's used across the application
export interface TypedRequest extends Omit<Request, 'session' | 'sessionID'> {
  session: Session & Partial<SessionData> & {
    user?: {
      id: string | number;
      [key: string]: unknown;
    };
  };
  sessionID: string;
  requestId?: string;
}

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

// Re-export LogMessage type from log for convenience
export type { LogMessage } from './log';

// Export the error handler type
export interface ErrorHandler {
  (err: Error | AppError, req: TypedRequest, res: Response, next: NextFunction): void;
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
    statusCode: res?.statusCode || 500,
    timestamp: new Date(),
    stack: error.stack
  };

  if ('context' in error) {
    Object.assign(context, (error as AppError).context);
  }

  const logMessage: LogMessage = {
    message: error.message,
    errorCode: 'context' in error ? (error as AppError).context?.errorCode : 'UNKNOWN_ERROR',
    level: 'error',
    metadata: {
      errorName: error.name,
      errorType: error.constructor.name,
      ...context
    }
  };
  
  log(logMessage, 'error');

  if (res) {
    res.setHeader('Content-Type', 'application/json');
    res.status(context.statusCode).json({
      error: error.message,
      errorCode: logMessage.errorCode,
      requestId: context.requestId
    });
  }

  return context;
}

export function initRequestTracking() {
  return (req: Request, _res: Response, next: Function) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || randomUUID();
    next();
  };
}
