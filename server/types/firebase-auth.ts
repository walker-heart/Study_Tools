import type { DecodedIdToken } from 'firebase-admin/auth';

// Base Firebase user interface with required fields
export interface FirebaseAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  tenantId?: string | null;
  providerData: UserInfo[];
  metadata?: {
    creationTime?: string;
    lastSignInTime?: string;
  };
}

// Provider user information
export interface UserInfo {
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
  providerId: string;
}

// Custom claims for role-based access control
export interface FirebaseCustomClaims {
  admin?: boolean;
  role?: 'user' | 'admin' | 'moderator';
  permissions?: string[];
}

// Extend DecodedIdToken with our custom claims
export interface ExtendedDecodedIdToken extends DecodedIdToken {
  admin?: boolean;
  role?: 'user' | 'admin' | 'moderator';
  permissions?: string[];
}

// Authentication state management
export interface AuthState {
  user: FirebaseAuthUser | null;
  loading: boolean;
  error: Error | null;
  initialized: boolean;
}

// Type guards
export function isAdmin(user: FirebaseAuthUser | null | undefined): boolean {
  if (!user) return false;
  return user.email?.endsWith('@admin.com') || false; // Replace with your admin check logic
}

export function hasAdminClaim(token: DecodedIdToken | null): token is ExtendedDecodedIdToken {
  if (!token) return false;
  return Boolean((token as ExtendedDecodedIdToken).admin);
}

// Express Request augmentation
declare global {
  namespace Express {
    interface Request {
      user?: ExtendedDecodedIdToken;
      firebaseUser?: FirebaseAuthUser;
      requestId?: string;
    }
  }
}

// Helper function to validate Firebase ID token
export function isValidFirebaseIdToken(token: unknown): token is DecodedIdToken {
  if (!token || typeof token !== 'object') return false;
  const requiredFields = ['uid', 'aud', 'iat', 'exp', 'iss'];
  return requiredFields.every(field => field in (token as DecodedIdToken));
}

export type { DecodedIdToken };
