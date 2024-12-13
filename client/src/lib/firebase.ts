import { initializeApp } from '@firebase/app';
import { 
  getAuth, 
  browserLocalPersistence, 
  setPersistence,
  connectAuthEmulator
} from '@firebase/auth';
import { 
  getFirestore, 
  enableMultiTabIndexedDbPersistence,
  connectFirestoreEmulator,
  collection,
  getDocs
} from '@firebase/firestore';

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validate Firebase config
const validateConfig = () => {
  const requiredFields = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];
  
  const missingFields = requiredFields.filter(
    field => !firebaseConfig[field as keyof typeof firebaseConfig]
  );
  
  if (missingFields.length > 0) {
    throw new Error(`Missing Firebase configuration fields: ${missingFields.join(', ')}`);
  }
  
  // Log config values for verification (excluding sensitive data)
  console.log('Firebase Config Validation:', {
    hasApiKey: !!firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    hasSenderId: !!firebaseConfig.messagingSenderId,
    hasAppId: !!firebaseConfig.appId
  });
};

// Initialize Firebase
try {
  validateConfig();
  console.log('Initializing Firebase with project:', firebaseConfig.projectId);
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw error;
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Test Firebase connectivity
export const testFirebaseConnection = async () => {
  try {
    // Test Firestore
    const testCollection = collection(db, '_test_connection');
    await getDocs(testCollection);
    console.log('✅ Firestore connection successful');
    
    // Test Auth
    const currentUser = auth.currentUser;
    console.log('✅ Auth initialized:', { isSignedIn: !!currentUser });
    
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

// Enable authentication persistence
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error('Error setting auth persistence:', error);
  });

// Enable Firestore persistence for offline support
enableMultiTabIndexedDbPersistence(db)
  .catch((error) => {
    console.error('Error enabling Firestore persistence:', error);
    if (error.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (error.code === 'unimplemented') {
      console.warn('The current browser does not support persistence.');
    }
  });

// Set up emulators for development
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
  
  console.log('Firebase initialized in development mode with config:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain
  });
}

export default app;
