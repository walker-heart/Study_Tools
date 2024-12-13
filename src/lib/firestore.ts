import { 
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  type DocumentData 
} from '@firebase/firestore';
import { db } from './firebase';

// Generic type for Firestore operations
type CollectionName = 'vocabulary' | 'users' | 'flashcards';

// Create or update a document
export const setDocument = async <T extends DocumentData>(
  collectionName: CollectionName,
  docId: string,
  data: T
) => {
  try {
    await setDoc(doc(db, collectionName, docId), data);
    return true;
  } catch (error: any) {
    console.error('Error setting document:', error);
    throw new Error(error.message);
  }
};

// Get a single document
export const getDocument = async <T extends DocumentData>(
  collectionName: CollectionName,
  docId: string
) => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as T;
    }
    return null;
  } catch (error: any) {
    console.error('Error getting document:', error);
    throw new Error(error.message);
  }
};

// Get documents with a query
export const getDocuments = async <T extends DocumentData>(
  collectionName: CollectionName,
  field: string,
  operator: '==' | '>' | '<' | '>=' | '<=',
  value: any
) => {
  try {
    const q = query(collection(db, collectionName), where(field, operator, value));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (T & { id: string })[];
  } catch (error: any) {
    console.error('Error getting documents:', error);
    throw new Error(error.message);
  }
};
