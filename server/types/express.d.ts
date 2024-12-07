import { User } from '@db/schema';
import 'express-session';
import 'express';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      email: string;
    };
    authenticated?: boolean;
    passport?: {
      user?: number;
    };
  }
}

// Error type extension
export interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
}

declare module 'express' {
  export interface Request {
    user?: User;
    isAuthenticated(): this is { user: User };
    logIn(user: User, callback: (err: any) => void): void;
    logout(callback: (err: any) => void): void;
  }
  
  export interface Response {
    locals: {
      user?: User;
    };
  }

  export interface ErrorRequestHandler {
    (err: ErrorWithStatus, req: Request, res: Response, next: NextFunction): Promise<void> | void;
  }
}