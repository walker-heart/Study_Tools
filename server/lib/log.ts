import { env } from './env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

export function log(message: string | Error, level: LogLevel = 'info'): void {
  const formattedMessage = formatMessage(level, message instanceof Error ? message.message : message);
  
  // In production, we might want to send logs to a service
  if (env.NODE_ENV === 'production') {
    console[level](formattedMessage);
    if (message instanceof Error && message.stack) {
      console[level](message.stack);
    }
  } else {
    // In development, use colored output
    const colors = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
      reset: '\x1b[0m'
    };
    
    console[level](`${colors[level]}${formattedMessage}${colors.reset}`);
    if (message instanceof Error && message.stack) {
      console[level](`${colors[level]}${message.stack}${colors.reset}`);
    }
  }
}

// Export convenience methods
export const debug = (message: string | Error) => log(message, 'debug');
export const info = (message: string | Error) => log(message, 'info');
export const warn = (message: string | Error) => log(message, 'warn');
export const error = (message: string | Error) => log(message, 'error');
