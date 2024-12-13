import { InferModel } from 'drizzle-orm';
import { users } from '../db/schema';

export type User = InferModel<typeof users>;

export interface GoogleProfile {
  id: string;
  displayName: string;
  emails?: Array<{ value: string; verified?: boolean }>;
  photos?: Array<{ value: string }>;
}

export interface AuthenticatedRequest extends Express.Request {
  user?: User;
}
