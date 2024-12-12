import { env } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMessage = string | Record<string, any>;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
}

function formatLog(level: LogLevel, message: LogMessage, metadata?: Record<string, any>): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: typeof message === 'string' ? message : JSON.stringify(message)
  };

  if (metadata || typeof message === 'object') {
    entry.metadata = {
      ...metadata,
      ...(typeof message === 'object' ? message : {})
    };
  }

  return entry;
}

function log(level: LogLevel, message: LogMessage, metadata?: Record<string, any>) {
  const entry = formatLog(level, message, metadata);

  if (env.NODE_ENV === 'production') {
    // In production, output JSON format for better log aggregation
    console.log(JSON.stringify(entry));
  } else {
    // In development, output human-readable format
    const meta = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    console.log(`[${entry.timestamp}] ${level.toUpperCase()}: ${entry.message}${meta}`);
  }
}

export const debug = (message: LogMessage, metadata?: Record<string, any>) => 
  log('debug', message, metadata);

export const info = (message: LogMessage, metadata?: Record<string, any>) => 
  log('info', message, metadata);

export const warn = (message: LogMessage, metadata?: Record<string, any>) => 
  log('warn', message, metadata);

export const error = (message: LogMessage, metadata?: Record<string, any>) => 
  log('error', message, metadata);
