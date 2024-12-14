import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from '../lib/env';
import { log, error } from '../lib/log';

let app: App;

try {
  // Initialize Firebase Admin only if no app exists
  if (getApps().length === 0) {
    if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
      throw new Error('Missing required Firebase configuration');
    }

    app = initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });

    log({
      message: 'Firebase Admin initialized successfully',
      metadata: {
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL?.replace(/(.{4}).*@/, '****@'),
      }
    });
  } else {
    app = getApps()[0];
    log({ message: 'Using existing Firebase Admin instance' });
  }
} catch (err) {
  error({
    message: 'Failed to initialize Firebase Admin',
    metadata: {
      error: err instanceof Error ? err.message : String(err),
      projectId: env.FIREBASE_PROJECT_ID,
    }
  });
  throw err;
}

// Export the auth instance
export const auth = getAuth(app);
