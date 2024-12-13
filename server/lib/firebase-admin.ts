import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { env } from './env';

// Validate Firebase config
const validateConfig = () => {
  const requiredFields = [
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_CLIENT_EMAIL',
    'VITE_FIREBASE_PRIVATE_KEY'
  ] as const;
  
  for (const field of requiredFields) {
    if (!env[field]) {
      throw new Error(`Missing required Firebase configuration: ${field}`);
    }
  }
  
  // Log config values for verification (excluding sensitive data)
  console.log('Firebase Admin Configuration:', {
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    hasClientEmail: !!env.VITE_FIREBASE_CLIENT_EMAIL,
    hasPrivateKey: !!env.VITE_FIREBASE_PRIVATE_KEY
  });
};

// Initialize Firebase
try {
  validateConfig();
  console.log('Initializing Firebase Admin with project:', env.VITE_FIREBASE_PROJECT_ID);
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        clientEmail: env.VITE_FIREBASE_CLIENT_EMAIL,
        // Private key is already formatted by the env schema
        privateKey: env.VITE_FIREBASE_PRIVATE_KEY,
      }),
      storageBucket: `${env.VITE_FIREBASE_PROJECT_ID}.appspot.com`
    });
  }
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
  throw error;
}

// Export auth and firestore instances
export const auth = getAuth();
export const firestore = getFirestore();

// Test Firebase connectivity
export const testFirebaseConnection = async () => {
  try {
    // Test Firestore
    const testCollection = firestore.collection('_test_connection');
    await testCollection.listDocuments();
    console.log('✅ Firestore connection successful');
    
    // Test Auth
    const listUsersResult = await auth.listUsers(1);
    console.log('✅ Auth connection successful, found', listUsersResult.users.length, 'users');
    
    return true;
  } catch (error) {
    console.error('❌ Firebase connection test failed:', error);
    return false;
  }
};

// Run the test immediately
testFirebaseConnection().then(success => {
  console.log('Firebase connection test completed:', success ? '✅ Success' : '❌ Failed');
});
