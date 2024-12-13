import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { env } from './env';

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  try {
    // Check if Firebase Admin is already initialized
    if (admin.apps && admin.apps.length > 0) {
      console.log('Firebase Admin already initialized');
      return admin.apps[0]!;
    }

    // Format private key if needed
    const privateKey = env.VITE_FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

    // Create service account config
    const serviceAccount = {
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL || env.VITE_FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY || env.VITE_FIREBASE_PRIVATE_KEY,
    };

    // Initialize new app
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET
    });

    console.log('Firebase Admin SDK initialized successfully', {
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      hasClientEmail: !!env.VITE_FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!privateKey,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET
    });

    return app;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
}

// Initialize Firebase Admin and get app instance
let app: admin.app.App;
try {
  app = initializeFirebaseAdmin();
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error);
  process.exit(1); // Exit if Firebase Admin initialization fails
}

// Initialize services
const auth = getAuth(app);
const firestore = getFirestore(app);

// Export instances
export { auth, firestore };

// Verify Firebase Admin SDK connectivity
async function verifyFirebaseConnection() {
  try {
    // Test Auth Service
    await auth.listUsers(1);
    console.log('✅ Firebase Auth is operational');

    // Test Firestore
    const testRef = firestore.collection('_connection_test').doc('test');
    await testRef.set({ timestamp: admin.firestore.FieldValue.serverTimestamp() });
    await testRef.delete();
    console.log('✅ Firestore is operational');

    return true;
  } catch (error) {
    console.error('❌ Firebase connection verification failed:', error);
    return false;
  }
}

// Verify connectivity
verifyFirebaseConnection()
  .then(isConnected => {
    if (isConnected) {
      console.log('🚀 Firebase Admin SDK is fully operational');
    } else {
      console.error('⚠️ Firebase Admin SDK services are not fully operational');
      console.error('Please check your Firebase configuration and credentials');
    }
  })
  .catch(error => {
    console.error('❌ Firebase verification error:', error);
  });
