import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      email: string;
      isAdmin?: boolean;
    };
    authenticated?: boolean;
  }
}

declare module 'express' {
  interface Request {
    session: SessionData;
  }
}

export {};
