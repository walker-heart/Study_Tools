import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
  sendPasswordResetEmail,
  type UserCredential
} from '@firebase/auth';
import { auth } from './firebase';

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
export const signUpWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    throw handleAuthError(error);
  }
};

export const signInWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
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

// Google Authentication
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const signInWithGoogle = async (): Promise<User> => {
  try {
    const result: UserCredential = await signInWithPopup(auth, googleProvider);
    return result.user;
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

// Auth State Observer
export const onAuthStateChange = (callback: (user: User | null) => void): () => void => {
  return onAuthStateChanged(auth, callback);
};

// Get Current User
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};
