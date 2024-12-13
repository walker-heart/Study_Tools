import * as admin from 'firebase-admin';
import { env } from './env';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL || `firebase-adminsdk-${env.FIREBASE_PROJECT_ID}@${env.FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`,
        privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      storageBucket: `${env.FIREBASE_PROJECT_ID}.appspot.com`
    });
    
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    throw error;
  }
}

export const auth = admin.auth();
export const firestore = admin.firestore();

// Test the Firebase Admin connection
auth.listUsers(1)
  .then(() => console.log('Firebase Admin connection verified'))
  .catch(error => console.error('Firebase Admin connection error:', error));
