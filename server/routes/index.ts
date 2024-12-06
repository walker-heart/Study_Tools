import { Express } from "express";
import { signUp, signIn, checkAuth } from "./auth";
import googleAuthRouter from "../auth/google";

export function registerRoutes(app: Express) {
  // Auth routes
  app.post('/api/auth/signup', signUp);
  app.post('/api/auth/signin', signIn);
  app.get('/api/auth/check', checkAuth);
  
  // Mount Google OAuth routes
  app.use('/api/auth', googleAuthRouter);
}
