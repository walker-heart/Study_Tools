import { Router, type Express } from "express";
import { signUp, signIn, signOut, checkAuth, checkAdmin, requireAdmin, getUsers, updateUser, updateUserPassword } from "./auth";
import { updateTheme, getTheme, getOpenAIKey, updateOpenAIKey, getUserAPIStats, testOpenAIEndpoint, analyzeImage, generateSpeech, translateText } from "./user";
import analyticsRoutes from "./analytics";
import proxyRoutes from "./proxy";

export function registerRoutes(app: Express): void {
  try {
    const router = Router();

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
    router.post('/api/user/test-openai', testOpenAIEndpoint);
    router.post('/api/user/analyze-image', analyzeImage);
    router.post('/api/user/generate-speech', generateSpeech);
    router.post('/api/ai/translate', translateText);

    // Admin routes
    router.get('/api/admin/users', requireAdmin, getUsers);
    router.put('/api/admin/users/:id', requireAdmin, updateUser);
    router.put('/api/admin/users/:id/password', requireAdmin, updateUserPassword);

    // Analytics routes
    router.use('/api/analytics', analyticsRoutes);

    // Proxy routes for external APIs
    router.use(proxyRoutes);

    // Use the router middleware
    app.use(router);
    console.log('API routes registered successfully');
  } catch (error) {
    console.error('Failed to register API routes:', error);
    throw error;
  }
}
