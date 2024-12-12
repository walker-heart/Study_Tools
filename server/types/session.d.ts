import 'express-session';
import { Session } from 'express-session';
import type { Store } from 'express-session';
import type { Pool, PoolConfig } from 'pg';

// Define additional types for error handling
export interface SessionErrorContext {
  operation: string;
  fallback?: string;
  tableName?: string;
  poolConfig?: PoolConfig;
  clientId?: string;
  timestamp?: Date;
}

export interface SessionError {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  error_message?: string;
  stack?: string;
  code?: string;
  metadata: {
    path?: string;
    status?: number;
    operation: string;
    tableName?: string;
    poolConfig?: PoolConfig;
    attempt?: number;
    total_attempts?: number;
    next_retry?: string | null;
    session_id?: string;
    request_id?: string;
  };
}

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      email: string;
      isAdmin?: boolean;
      firstName?: string;
      lastName?: string;
      settings?: Record<string, unknown>;
      preferences?: Record<string, unknown>;
    };
    authenticated?: boolean;
    originalID?: string;
    lastAccess?: Date;
    createdAt?: Date;
    requestId?: string;
    metadata?: Record<string, unknown>;
  }

  interface SessionStore extends Store {
    pool: Pool;
    tableName: string;
    pruneSessionInterval?: number;
    createTableIfMissing?: boolean;
    errorLog?: (error: Error) => void;
    ttl?: number;
    disableTouch?: boolean;
    poolConfig?: PoolConfig;
  }

  interface SessionOptions {
    store?: SessionStore;
    cookie?: {
      secure?: boolean;
      httpOnly?: boolean;
      domain?: string;
      path?: string;
      sameSite?: boolean | 'lax' | 'strict' | 'none';
      maxAge?: number;
      expires?: Date;
    };
    proxy?: boolean;
    name?: string;
    resave?: boolean;
    rolling?: boolean;
    saveUninitialized?: boolean;
    secret: string | string[];
  }
}

declare module 'express' {
  interface Request {
    session: Session & Partial<SessionData>;
    sessionID: string;
    requestId?: string;
  }

  interface Response {
    locals: {
      sessionID?: string;
      requestId?: string;
      [key: string]: unknown;
    };
  }
}

export {};
