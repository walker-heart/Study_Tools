import { User } from '@db/schema';
import 'express-session';

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
}
