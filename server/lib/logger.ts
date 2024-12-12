// Logger utility for consistent logging across the application
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

interface LogOptions {
  level?: LogLevel;
  timestamp?: boolean;
  metadata?: Record<string, any>;
}

function formatMessage(message: string, options: LogOptions = {}): string {
  const parts: string[] = [];
  
  // Add timestamp
  if (options.timestamp !== false) {
    parts.push(`[${new Date().toISOString()}]`);
  }
  
  // Add log level
  if (options.level) {
    parts.push(`[${options.level}]`);
  }
  
  // Add message
  parts.push(message);
  
  // Add metadata if present
  if (options.metadata) {
    try {
      parts.push(JSON.stringify(options.metadata));
    } catch (error) {
      parts.push('[Error serializing metadata]');
    }
  }
  
  return parts.join(' ');
}

export function log(message: string | Error, options: LogOptions = {}): void {
  const level = options.level || 'INFO';
  
  if (message instanceof Error) {
    console.error(formatMessage(message.message, { ...options, level: 'ERROR' }));
    if (message.stack) {
      console.error(message.stack);
    }
    return;
  }
  
  switch (level) {
    case 'ERROR':
      console.error(formatMessage(message, options));
      break;
    case 'WARN':
      console.warn(formatMessage(message, options));
      break;
    case 'DEBUG':
      console.debug(formatMessage(message, options));
      break;
    default:
      console.log(formatMessage(message, options));
  }
}

// Export common log level functions
export const debug = (message: string, metadata?: Record<string, any>) => 
  log(message, { level: 'DEBUG', metadata });

export const info = (message: string, metadata?: Record<string, any>) => 
  log(message, { level: 'INFO', metadata });

export const warn = (message: string, metadata?: Record<string, any>) => 
  log(message, { level: 'WARN', metadata });

export const error = (message: string | Error, metadata?: Record<string, any>) => 
  log(message, { level: 'ERROR', metadata });
