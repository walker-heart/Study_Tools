import { initializeApp, type FirebaseOptions } from '@firebase/app';
import { 
  getAuth, 
  browserLocalPersistence, 
  setPersistence
} from '@firebase/auth';
import { 
  getFirestore, 
  enableMultiTabIndexedDbPersistence
} from '@firebase/firestore';

// Firebase configuration using environment variables
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase (ensuring single initialization)
function initializeFirebase() {
  try {
    // Validate required configuration
    const requiredFields = [
      'apiKey',
      'authDomain',
      'projectId',
      'storageBucket',
      'messagingSenderId',
      'appId'
    ] as const;

    const missingFields = requiredFields.filter(
      field => !firebaseConfig[field]
    );

    if (missingFields.length > 0) {
      throw new Error(`Missing Firebase configuration: ${missingFields.join(', ')}`);
    }

    // Log non-sensitive config for verification
    console.log('Firebase Client Configuration:', {
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      hasApiKey: !!firebaseConfig.apiKey,
      hasAppId: !!firebaseConfig.appId
    });

    return initializeApp(firebaseConfig);
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

// Initialize Firebase app
const app = initializeFirebase();

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);

// Enable authentication persistence
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error('Error setting auth persistence:', error);
  });

// Enable Firestore offline persistence
enableMultiTabIndexedDbPersistence(db)
  .catch((error) => {
    if (error.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (error.code === 'unimplemented') {
      console.warn('The current browser does not support persistence.');
    }
    console.error('Error enabling Firestore persistence:', error);
  });

// Export instances
export { app, auth, db };
export default app;