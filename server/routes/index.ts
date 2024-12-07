import type { Express, Router } from "express";
import { signUp, signIn, checkAuth, checkAdmin } from "./auth";
import { updateTheme, getTheme } from "./user";

export function registerRoutes(app: Express): Router | void {
  // Auth routes - Email/Password only
  app.post('/api/auth/signup', signUp);
  app.post('/api/auth/signin', signIn);
  app.get('/api/auth/check', checkAuth);
  app.get('/api/auth/check-admin', checkAdmin);

  // User routes
  app.get('/api/user/theme', getTheme);
  app.put('/api/user/theme', updateTheme);
}
