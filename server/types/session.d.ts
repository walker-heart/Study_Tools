import 'express-session';
import { Session } from 'express-session';

import 'express-session';
import type { Store } from 'express-session';
import type { Pool } from 'pg';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      email: string;
      isAdmin?: boolean;
      firstName?: string;
      lastName?: string;
      settings?: Record<string, unknown>;
    };
    authenticated: boolean;
    originalID?: string;
    lastAccess?: Date;
    createdAt?: Date;
  }

  interface SessionOptions {
    store?: Store & {
      pool: Pool;
      tableName: string;
      pruneSessionInterval?: number;
      createTableIfMissing?: boolean;
      errorLog?: (error: Error) => void;
    };
  }
}

declare module 'express' {
  interface Request {
    session: Session & SessionData;
    sessionID: string;
    requestId?: string;
  }
}

export {};
