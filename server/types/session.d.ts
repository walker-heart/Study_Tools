import 'express-session';
import { Session } from 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      email: string;
      isAdmin?: boolean;
    };
    authenticated?: boolean;
    originalID?: string;
  }

  interface SessionOptions {
    store?: ReturnType<typeof import('connect-pg-simple')>;
  }
}

declare module 'express' {
  interface Request {
    session: Session & SessionData;
    sessionID?: string;
  }
}

export {};
