import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from '../lib/env';

// Initialize Firebase Admin with environment variables
const app = initializeApp({
  credential: cert({
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: env.VITE_FIREBASE_CLIENT_EMAIL,
    privateKey: env.VITE_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

// Export the auth instance
export const auth = getAuth(app);
