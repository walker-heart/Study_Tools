import { Router } from "express";
import { signUp, signIn, signOut, checkAuth } from "./auth";

export function registerRoutes(): Router {
  const router = Router();

  // Auth routes - Email/Password only
  router.post('/api/auth/signup', signUp);
  router.post('/api/auth/signin', signIn);
  router.post('/api/auth/signout', signOut);
  router.get('/api/auth/check', checkAuth);

  return router;
}
