import { Router, type Express } from "express";
import { signUp, signIn, checkAuth, checkAdmin } from "./auth";
import { updateTheme, getTheme } from "./user";

export function registerRoutes(app: Express): void {
  const router = Router();

  // Auth routes - Email/Password only
  router.post('/api/auth/signup', signUp);
  router.post('/api/auth/signin', signIn);
  router.get('/api/auth/check', checkAuth);
  router.get('/api/auth/check-admin', checkAdmin);

  // User routes
  router.get('/api/user/theme', getTheme);
  router.put('/api/user/theme', updateTheme);

  // Use the router middleware
  app.use(router);
}
