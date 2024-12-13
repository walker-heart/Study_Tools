import { Session } from 'express-session';

// Extend the session with our custom user property
declare module 'express-session' {
  interface Session {
    authType?: 'signup' | 'signin';
    user?: {
      id: string | number;
      email: string;
      isAdmin: boolean;
    };
  }
}

// Define our user type
export interface SessionUser {
  id: string | number;
  email: string;
  isAdmin: boolean;
}

// Define the structure of our database user
export interface DbUser {
  id: string | number;
  google_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_admin: boolean;
  name?: string;
  picture?: string;
}
