import { env } from './env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  tableName?: string;
  poolConfig?: {
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  }
}

export interface LogMessage {
  message: string;
  path?: string;
  method?: string;
  status?: number;
  stack?: string;
  origin?: string;
  ip?: string;
  realIP?: string | string[];
  forwardedFor?: string | string[];
  allowedOrigins?: string[];
  level?: LogLevel;
  errorCode?: string;
  error_message?: string;
  attempt?: number;
  total_attempts?: number;
  next_retry?: string | null;
  retries_left?: number;
  context?: LogContext;
  metadata?: Record<string, unknown>;
}

interface FormattedLogObject {
  timestamp: string;
  level: string;
  message: string;
  requestId?: unknown;
  path?: string;
  method?: string;
  status?: number;
  errorCode?: string;
  ip?: string;
  userId?: unknown;
  stack?: string;
  [key: string]: unknown;
}

function formatMessage(level: LogLevel, message: string, details?: Partial<LogMessage>): string {
  const timestamp = new Date().toISOString();
  const logObject: FormattedLogObject = {
    timestamp,
    level: level.toUpperCase(),
    message,
    requestId: details?.metadata?.requestId,
    path: details?.path,
    method: details?.method,
    status: details?.status,
    errorCode: details?.errorCode,
    ip: details?.ip,
    userId: details?.metadata?.userId
  };

  // Add metadata fields
  if (details?.metadata) {
    Object.entries(details.metadata).forEach(([key, value]) => {
      logObject[key] = value;
    });
  }

  // Add stack trace if present
  if (details?.stack) {
    logObject.stack = details.stack;
  }

  if (env.NODE_ENV === 'production') {
    // In production, return JSON format for easier parsing
    return JSON.stringify(logObject);
  } else {
    // In development, return human-readable format
    const parts: string[] = [
      `[${timestamp}]`,
      `[${level.toUpperCase()}]`,
      message
    ];

    if (details?.path) parts.push(`Path: ${details.path}`);
    if (details?.method) parts.push(`Method: ${details.method}`);
    if (details?.status) parts.push(`Status: ${details.status}`);
    if (details?.errorCode) parts.push(`Error: ${details.errorCode}`);
    if (details?.metadata?.requestId) parts.push(`RequestID: ${details.metadata.requestId}`);

    return parts.join(' | ');
  }
}

export function log(input: string | Error | LogMessage, level?: LogLevel): void {
  const colors = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m',  // green
    warn: '\x1b[33m',  // yellow
    error: '\x1b[31m', // red
    reset: '\x1b[0m'
  };

  let message: string;
  let stack: string | undefined;
  let details: Partial<LogMessage> | undefined;
  let logLevel: LogLevel;

  if (typeof input === 'string') {
    message = input;
    logLevel = level || 'info';
  } else if (input instanceof Error) {
    message = input.message;
    stack = input.stack;
    logLevel = level || 'error';
  } else {
    message = input.message;
    stack = input.stack;
    logLevel = level || input.level || 'info';
    details = {
      path: input.path,
      method: input.method,
      status: input.status,
      level: logLevel
    };
  }

  const formattedMessage = formatMessage(logLevel, message, details);
  const consoleMethod = console[logLevel] || console.log;
  
  if (env.NODE_ENV === 'production') {
    consoleMethod(formattedMessage);
    if (stack) {
      consoleMethod(stack);
    }
  } else {
    consoleMethod(`${colors[logLevel]}${formattedMessage}${colors.reset}`);
    if (stack) {
      consoleMethod(`${colors[logLevel]}${stack}${colors.reset}`);
    }
  }
}

// Helper function to create a LogMessage from various input types
function createLogMessage(
  input: string | Error | Partial<Omit<LogMessage, 'level'>>, 
  level: LogLevel
): LogMessage {
  if (typeof input === 'string') {
    return { message: input, level };
  }
  if (input instanceof Error) {
    return {
      message: input.message,
      stack: input.stack,
      level
    };
  }
  return { ...input, message: input.message || 'No message provided', level };
}

// Export convenience methods
export const debug = (input: string | Error | Omit<LogMessage, 'level'>): void => 
  log(typeof input === 'string' || input instanceof Error ? input : { ...input, level: 'debug' }, 'debug');
export const info = (input: string | Error | Omit<LogMessage, 'level'>): void => 
  log(typeof input === 'string' || input instanceof Error ? input : { ...input, level: 'info' }, 'info');
export const warn = (input: string | Error | Omit<LogMessage, 'level'>): void => 
  log(typeof input === 'string' || input instanceof Error ? input : { ...input, level: 'warn' }, 'warn');
export const error = (input: string | Error | Omit<LogMessage, 'level'>): void => 
  log(typeof input === 'string' || input instanceof Error ? input : { ...input, level: 'error' }, 'error');
