import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      email: string;
      name: string;
      picture?: string;
      google_id: string;
    };
    authenticated?: boolean;
  }
}
