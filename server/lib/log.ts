import { env } from './env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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
  level?: 'debug' | 'info' | 'warn' | 'error';
  errorCode?: string;
  metadata?: Record<string, any>;
}

function formatMessage(level: LogLevel, message: string, details?: Partial<LogMessage>): string {
  const timestamp = new Date().toISOString();
  const logObject = {
    timestamp,
    level: level.toUpperCase(),
    message,
    requestId: details?.metadata?.requestId,
    path: details?.path,
    method: details?.method,
    status: details?.status,
    errorCode: details?.errorCode,
    ip: details?.ip,
    userId: details?.metadata?.userId,
    ...(details?.metadata || {}),
    ...(details?.stack ? { stack: details.stack } : {})
  };

  if (env.NODE_ENV === 'production') {
    // In production, return JSON format for easier parsing
    return JSON.stringify(logObject);
  } else {
    // In development, return human-readable format
    let formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (details?.path) formatted += ` | Path: ${details.path}`;
    if (details?.method) formatted += ` | Method: ${details.method}`;
    if (details?.status) formatted += ` | Status: ${details.status}`;
    if (details?.errorCode) formatted += ` | Error: ${details.errorCode}`;
    if (details?.metadata?.requestId) formatted += ` | RequestID: ${details.metadata.requestId}`;
    return formatted;
  }
}

export function log(input: string | Error | LogMessage, level: LogLevel = 'info'): void {
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

  if (typeof input === 'string') {
    message = input;
  } else if (input instanceof Error) {
    message = input.message;
    stack = input.stack;
  } else {
    message = input.message;
    stack = input.stack;
    details = {
      path: input.path,
      method: input.method,
      status: input.status
    };
  }

  const formattedMessage = formatMessage(level, message, details);
  
  if (env.NODE_ENV === 'production') {
    console[level](formattedMessage);
    if (stack) {
      console[level](stack);
    }
  } else {
    console[level](`${colors[level]}${formattedMessage}${colors.reset}`);
    if (stack) {
      console[level](`${colors[level]}${stack}${colors.reset}`);
    }
  }
}

// Export convenience methods
export const debug = (message: string | Error | LogMessage) => log(message, 'debug');
export const info = (message: string | Error | LogMessage) => log(message, 'info');
export const warn = (message: string | Error | LogMessage) => log(message, 'warn');
export const error = (message: string | Error | LogMessage) => log(message, 'error');
