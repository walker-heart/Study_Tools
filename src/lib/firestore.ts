import { 
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  type DocumentData,
  type QueryConstraint,
  type DocumentReference,
  type WithFieldValue,
  serverTimestamp
} from '@firebase/firestore';
import { db } from './firebase';

// Generic type for Firestore operations
export type CollectionName = 'vocabulary' | 'users' | 'flashcards';

// Firestore error handling
export interface FirestoreError {
  code: string;
  message: string;
}

const handleFirestoreError = (error: any): FirestoreError => {
  console.error('Firestore error:', error);
  return {
    code: error.code || 'unknown',
    message: error.message || 'An unknown error occurred'
  };
};

// Create or update a document
export const setDocument = async <T extends DocumentData>(
  collectionName: CollectionName,
  docId: string,
  data: WithFieldValue<T>
): Promise<boolean> => {
  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
      createdAt: data.createdAt || serverTimestamp()
    });
    return true;
  } catch (error: any) {
    throw handleFirestoreError(error);
  }
};

// Update a document
export const updateDocument = async <T extends DocumentData>(
  collectionName: CollectionName,
  docId: string,
  data: Partial<WithFieldValue<T>>
): Promise<boolean> => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error: any) {
    throw handleFirestoreError(error);
  }
};

// Get a single document
export const getDocument = async <T extends DocumentData>(
  collectionName: CollectionName,
  docId: string
): Promise<T | null> => {
  try {
    const docRef: DocumentReference = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as T;
    }
    return null;
  } catch (error: any) {
    throw handleFirestoreError(error);
  }
};

// Delete a document
export const deleteDocument = async (
  collectionName: CollectionName,
  docId: string
): Promise<boolean> => {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    return true;
  } catch (error: any) {
    throw handleFirestoreError(error);
  }
};

// Get documents with a query
export const getDocuments = async <T extends DocumentData>(
  collectionName: CollectionName,
  queries: {
    field: string;
    operator: '==' | '>' | '<' | '>=' | '<=';
    value: any;
  }[],
  options?: {
    orderByField?: string;
    orderDirection?: 'asc' | 'desc';
    limitTo?: number;
  }
): Promise<(T & { id: string })[]> => {
  try {
    const constraints: QueryConstraint[] = queries.map(q => 
      where(q.field, q.operator, q.value)
    );

    if (options?.orderByField) {
      constraints.push(orderBy(options.orderByField, options.orderDirection || 'asc'));
    }

    if (options?.limitTo) {
      constraints.push(limit(options.limitTo));
    }

    const q = query(collection(db, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({ 
      id: doc.id,
      ...doc.data()
    })) as (T & { id: string })[];
  } catch (error: any) {
    throw handleFirestoreError(error);
  }
};
