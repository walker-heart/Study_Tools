import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  type DocumentData,
  type QuerySnapshot,
  type DocumentSnapshot
} from '@firebase/firestore';
import { app } from './firebase';

// Initialize Firestore
export const db = getFirestore(app);

// Types
export interface User {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt?: Date;
}

// Collection References
export const usersCollection = collection(db, 'users');

// User Operations
export async function createUser(userData: Omit<User, 'id'>): Promise<string> {
  try {
    const docRef = await addDoc(usersCollection, {
      ...userData,
      createdAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

export async function getUser(userId: string): Promise<User | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() } as User;
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
}

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const q = query(usersCollection, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as User;
    }
    return null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  }
}

export async function updateUser(userId: string, userData: Partial<User>): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, userData);
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

// Example of how to use onSnapshot for real-time updates
// export function subscribeToUser(userId: string, callback: (user: User | null) => void): () => void {
//   const userRef = doc(db, 'users', userId);
//   return onSnapshot(userRef, (doc) => {
//     if (doc.exists()) {
//       callback({ id: doc.id, ...doc.data() } as User);
//     } else {
//       callback(null);
//     }
//   });
// }
