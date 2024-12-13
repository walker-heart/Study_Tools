import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { env } from './env';

// Service Account Type
interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  try {
    // Check if Firebase Admin is already initialized
    if (admin.apps && admin.apps.length > 0) {
      console.log('Firebase Admin already initialized');
      return admin.apps[0]!;
    }

    // Create service account configuration
    const serviceAccount: ServiceAccount = {
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: env.VITE_FIREBASE_CLIENT_EMAIL,
      privateKey: env.VITE_FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };

    // Log initialization attempt (without sensitive data)
    console.log('Attempting Firebase Admin initialization with:', {
      projectId: serviceAccount.projectId,
      hasClientEmail: !!serviceAccount.clientEmail,
      hasPrivateKey: !!serviceAccount.privateKey,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET
    });

    // Initialize new app
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
    });

    console.log('Firebase Admin SDK initialized successfully', {
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      hasClientEmail: !!env.VITE_FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!env.VITE_FIREBASE_PRIVATE_KEY,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET
    });

    return app;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET
    });
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
