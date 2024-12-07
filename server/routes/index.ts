import type { Express, Router } from "express";
import { signUp, signIn, checkAuth } from "./auth";
import googleAuthRouter from "../auth/google";

export function registerRoutes(app: Express): Router | void {
  // Auth routes
  app.post('/api/auth/signup', signUp);
  app.post('/api/auth/signin', signIn);
  app.get('/api/auth/check', checkAuth);
  
  // Mount Google OAuth routes
  app.use('/api/auth/google', googleAuthRouter);
}
