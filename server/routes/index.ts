import { Router, type Express } from "express";
import { signUp, signIn, checkAuth, checkAdmin, requireAdmin, getUsers, updateUser, updateUserPassword } from "./auth";
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

  // Admin routes
  router.get('/api/admin/users', requireAdmin, getUsers);
  router.put('/api/admin/users/:id', requireAdmin, updateUser);
  router.put('/api/admin/users/:id/password', requireAdmin, updateUserPassword);

  // Use the router middleware
  app.use(router);
}
