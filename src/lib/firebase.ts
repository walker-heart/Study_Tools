import { initializeApp, type FirebaseApp } from '@firebase/app';
import { getAuth, type Auth } from '@firebase/auth';
import { getFirestore, type Firestore } from '@firebase/firestore';
import { log, error } from '../../server/lib/log';

// Validate required environment variables
const requiredVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID'
] as const;

const missingVars = requiredVars.filter(key => !import.meta.env[key]);
if (missingVars.length > 0) {
  throw new Error(`Missing required Firebase configuration: ${missingVars.join(', ')}`);
}

// Load environment-specific configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 
    `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 
    `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  // Initialize Firebase
  app = initializeApp(firebaseConfig);
  
  // Initialize Firebase Authentication
  auth = getAuth(app);
  auth.useDeviceLanguage(); // Set language to user's device language
  
  // Initialize Cloud Firestore
  db = getFirestore(app);
  
  log({
    message: 'Firebase client initialized successfully',
    metadata: {
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain
    }
  });
} catch (err) {
  error({
    message: 'Failed to initialize Firebase client',
    metadata: {
      error: err instanceof Error ? err.message : String(err),
      projectId: firebaseConfig.projectId
    }
  });
  throw err;
}

export { app, auth, db };
export type { FirebaseApp, Auth, Firestore };
