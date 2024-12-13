import { Router, type Express } from "express";
import authRouter, { checkAdmin } from "./auth";
import { requireAdmin } from "../middleware/auth";
import { auth } from "../lib/firebase-admin";
import { updateTheme, getTheme, getOpenAIKey, updateOpenAIKey, getUserAPIStats, testOpenAIEndpoint, analyzeImage, generateSpeech, translateText } from "./user";
import analyticsRoutes from "./analytics";
import proxyRoutes from "./proxy";

export function registerRoutes(app: Express): void {
  const router = Router();

  // Auth routes - Firebase based
  router.use('/api/auth', authRouter);
  router.get('/api/auth/check-admin', checkAdmin);

  // User routes
  router.get('/api/user/theme', getTheme);
  router.put('/api/user/theme', updateTheme);
  router.get('/api/user/openai-key', getOpenAIKey);
  router.put('/api/user/openai-key', updateOpenAIKey);
  router.get('/api/user/api-stats', getUserAPIStats);
  router.post('/api/user/test-openai', testOpenAIEndpoint);
  router.post('/api/user/analyze-image', analyzeImage);
  router.post('/api/user/generate-speech', generateSpeech);
  router.post('/api/ai/translate', translateText);

  // Admin routes
  router.get('/api/admin/users', requireAdmin, async (_req, res) => {
    try {
      const listUsersResult = await auth.listUsers();
      res.json({ users: listUsersResult.users });
    } catch (error) {
      console.error('Error listing users:', error);
      res.status(500).json({ error: 'Failed to list users' });
    }
  });

  router.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { displayName, email, disabled } = req.body;
      
      await auth.updateUser(id, {
        displayName,
        email,
        disabled
      });
      
      res.json({ message: 'User updated successfully' });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  router.put('/api/admin/users/:id/password', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      
      await auth.updateUser(id, { password });
      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).json({ error: 'Failed to update password' });
    }
  });

  // Analytics routes
  router.use('/api/analytics', analyticsRoutes);

  // Proxy routes for external APIs
  router.use(proxyRoutes);

  // Use the router middleware
  app.use(router);
}