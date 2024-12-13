import { initializeApp } from '@firebase/app';
import { getAuth } from '@firebase/auth';
import { getFirestore } from '@firebase/firestore';

// Environment detection
const isDevelopment = window.location.hostname.includes('replit.dev');
const currentDomain = window.location.hostname;

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Configure environment-specific settings
if (isDevelopment) {
  console.log('🔧 Running in development mode');
  console.log('📍 Current domain:', currentDomain);
  
  // Enable detailed logging in development
  auth.useDeviceLanguage();
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
