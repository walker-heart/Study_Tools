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

declare module 'express' {
  interface Request {
    user?: User;
  }
  
  interface Response {
    locals: {
      user?: User;
    };
  }
}

// Error type extension
export interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
    
    interface Response {
      locals: {
        user?: User;
      };
    }

    interface ErrorRequestHandler {
      (err: ErrorWithStatus, req: Request, res: Response, next: NextFunction): void;
    }
  }
}
