import { Router } from "express";
import { signUp, signIn, signOut, checkAuth, checkAdmin, requireAdmin, getUsers, updateUser, updateUserPassword } from "./auth";
import { updateTheme, getTheme, getOpenAIKey, updateOpenAIKey, getUserAPIStats, testOpenAIEndpoint, analyzeImage, generateSpeech, translateText } from "./user";
import analyticsRoutes from "./analytics";
import proxyRoutes from "./proxy";

export function registerRoutes(router: Router): void {
  // Auth routes - Email/Password only
  router.post('/auth/signup', signUp);
  router.post('/auth/signin', signIn);
  router.post('/auth/signout', signOut);
  router.get('/auth/check', checkAuth);
  router.get('/auth/check-admin', checkAdmin);

  // User routes
  router.get('/user/theme', getTheme);
  router.put('/user/theme', updateTheme);
  router.get('/user/openai-key', getOpenAIKey);
  router.put('/user/openai-key', updateOpenAIKey);
  router.get('/user/api-stats', getUserAPIStats);
  router.post('/user/test-openai', testOpenAIEndpoint);
  router.post('/user/analyze-image', analyzeImage);
  router.post('/user/generate-speech', generateSpeech);
  router.post('/ai/translate', translateText);

  // Admin routes
  router.get('/admin/users', requireAdmin, getUsers);
  router.put('/admin/users/:id', requireAdmin, updateUser);
  router.put('/admin/users/:id/password', requireAdmin, updateUserPassword);

  // Analytics routes
  router.use('/analytics', analyticsRoutes);

  // Proxy routes for external APIs
  router.use('/', proxyRoutes);
}
