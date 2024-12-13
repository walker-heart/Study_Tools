import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type User,
  type UserCredential
} from '@firebase/auth';
import { auth } from '../firebase';
import { createUser } from '../firestore';

// Types
export interface AuthError {
  code: string;
  message: string;
}

// Error handling
const handleAuthError = (error: any): AuthError => {
  console.error('Authentication error:', error);
  return {
    code: error.code || 'auth/unknown',
    message: error.message || 'An unknown error occurred'
  };
};

// Email & Password Authentication
export const signUpWithEmail = async (email: string, password: string, firstName?: string, lastName?: string): Promise<User> => {
  try {
    const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Create user document in Firestore
    await createUser({
      email: userCredential.user.email!,
      firstName,
      lastName,
      createdAt: new Date()
    });
    
    return userCredential.user;
  } catch (error: any) {
    throw handleAuthError(error);
  }
};

export const signInWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    throw handleAuthError(error);
  }
};

// Sign Out
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    throw handleAuthError(error);
  }
};

// Password Reset
export const resetPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    throw handleAuthError(error);
  }
};

// Auth State Observer
export const onAuthStateChange = (callback: (user: User | null) => void): () => void => {
  return onAuthStateChanged(auth, callback);
};

// Get Current User
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};
