import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      email: string;
      name: string;
      picture?: string;
      googleId?: string;
    };
  }
}
