import { Request, Response } from "express";
import { Router } from 'express';
import { auth, firestore } from '../lib/firebase-admin';

// Initialize router
const router = Router();

// Export auth check functions
export const checkAdmin = async (req: Request, res: Response) => {
  try {
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Invalid authorization header format" });
    }

    const token = req.headers.authorization.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    const { email, uid } = decodedToken;

    // Check if user exists in Firestore
    const userDoc = await firestore.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(403).json({ message: "User not found" });
    }

    const userData = userDoc.data();
    if (!userData?.isAdmin) {
      return res.status(403).json({ message: "Not an admin" });
    }

    res.json({ isAdmin: true, email });
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(401).json({ message: "Authentication failed" });
  }
};

// Verify Firebase token middleware
export const verifyFirebaseToken = async (req: Request, res: Response, next: Function) => {
  try {
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Invalid authorization header format" });
    }

    const token = req.headers.authorization.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ message: "Invalid token" });
  }
};

// Check authentication status
const checkAuth = async (req: Request, res: Response) => {
  try {
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      return res.status(401).json({ 
        authenticated: false,
        message: "Invalid authorization header format" 
      });
    }

    const token = req.headers.authorization.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    res.json({
      authenticated: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email
      }
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(401).json({ 
      authenticated: false,
      message: "Invalid token"
    });
  }
};

// Configure routes
router.get('/check', checkAuth);
router.get('/check-admin', checkAdmin);

// Export auth middleware
export { verifyFirebaseToken };

// Export router
export default router;