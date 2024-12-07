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
  }
  
  export interface Response {
    locals: {
      user?: User;
    };
  }

  export interface ErrorRequestHandler {
    (err: ErrorWithStatus, req: Request, res: Response, next: NextFunction): void;
  }
}