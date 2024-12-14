// Import Firebase auth types from our centralized type definition file
import type { ExtendedDecodedIdToken } from './firebase-auth';

// Only declare additional non-Firebase related session types here
declare module 'express-session' {
  interface SessionData {
    requestId?: string;
  }
}

export {};
