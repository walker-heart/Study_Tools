import type { Express, Router } from "express";
import { signUp, signIn, checkAuth } from "./auth";

export function registerRoutes(app: Express): Router | void {
  // Auth routes - Email/Password only
  app.post('/api/auth/signup', signUp);
  app.post('/api/auth/signin', signIn);
  app.get('/api/auth/check', checkAuth);
}
