import { Router, type Express } from "express";
import { signUp, signIn, signOut, checkAuth, checkAdmin, requireAdmin, getUsers, updateUser, updateUserPassword } from "./auth";
import { updateTheme, getTheme, getOpenAIKey, updateOpenAIKey, getUserAPIStats, testOpenAIEndpoint } from "./user";
import analyticsRoutes from "./analytics";
import { apiMonitoringMiddleware, rateLimitMiddleware } from "../middleware/apiMonitoring";

export function registerRoutes(app: Express): void {
  const router = Router();
  
  // Apply API monitoring middleware to all routes
  router.use(apiMonitoringMiddleware);

  // Auth routes - Email/Password only
  router.post('/api/auth/signup', signUp);
  router.post('/api/auth/signin', signIn);
  router.post('/api/auth/signout', signOut);
  router.get('/api/auth/check', checkAuth);
  router.get('/api/auth/check-admin', checkAdmin);

  // User routes
  router.get('/api/user/theme', getTheme);
  router.put('/api/user/theme', updateTheme);
  router.get('/api/user/openai-key', getOpenAIKey);
  router.put('/api/user/openai-key', updateOpenAIKey);
  router.get('/api/user/api-stats', getUserAPIStats);
  router.post('/api/user/test-openai', rateLimitMiddleware, testOpenAIEndpoint);

  // Admin routes
  router.get('/api/admin/users', requireAdmin, getUsers);
  router.put('/api/admin/users/:id', requireAdmin, updateUser);
  router.put('/api/admin/users/:id/password', requireAdmin, updateUserPassword);

  // Analytics routes
  router.use('/api/analytics', analyticsRoutes);

  // Use the router middleware
  app.use(router);
}
