import { initializeApp } from '@firebase/app';
import { getAuth } from '@firebase/auth';
import { getFirestore } from '@firebase/firestore';

// Environment detection
const isDevelopment = window.location.hostname.includes('replit.dev');
const currentDomain = window.location.hostname;

// Firebase configuration with environment-specific settings
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  projectId: process.env.FIREBASE_PROJECT_ID,
  appId: process.env.FIREBASE_APP_ID,
  // Use the current domain for authDomain to support both environments
  authDomain: isDevelopment
    ? '343460df-6523-41a1-9a70-d687f288a6a5-00-25snbpzyn9827.spock.replit.dev'
    : 'wtoolsw.com',
  storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
  // Add messagingSenderId if you plan to use Firebase Cloud Messaging
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Configure environment-specific settings
if (isDevelopment) {
  console.log('🔧 Running in development mode');
  console.log('📍 Current domain:', currentDomain);
  
  // Enable detailed logging in development
  auth.useDeviceLanguage();
  // You can enable Firebase emulators here if needed
  // if (process.env.USE_FIREBASE_EMULATOR === 'true') {
  //   connectAuthEmulator(auth, 'http://localhost:9099');
  //   connectFirestoreEmulator(db, 'localhost', 8080);
  // }
} else {
  console.log('🚀 Running in production mode');
  console.log('📍 Current domain:', currentDomain);
  
  // Production-specific configurations
  auth.useDeviceLanguage();
  // Disable detailed logging in production
  console.log = () => {};
  console.debug = () => {};
}

// Export configuration and instances
export {
  app,
  auth,
  db,
  isDevelopment,
  firebaseConfig
};
