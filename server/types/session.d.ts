import { DecodedIdToken } from 'firebase-admin/auth';

declare module 'express-session' {
  interface SessionData {
    // Remove old session-specific properties since we're using Firebase tokens
  }
}

declare module 'express' {
  interface Request {
    user?: DecodedIdToken & {
      admin?: boolean;
      uid: string;
      email?: string;
    };
    requestId?: string;
  }
}

export {};
