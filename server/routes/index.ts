import { Router, type Express } from "express";
import { signUp, signIn, signOut, checkAuth, checkAdmin, requireAdmin, getUsers, updateUser, updateUserPassword } from "./auth";
import { updateTheme, getTheme, getOpenAIKey, updateOpenAIKey, getUserAPIStats, testOpenAIEndpoint, analyzeImage, generateSpeech, translateText } from "./user";
import analyticsRoutes from "./analytics";
import proxyRoutes from "./proxy";
import { log } from "../lib/logger";

// Error handling middleware
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

export function registerRoutes(app: Express): void {
  try {
    const router = Router();

    // Auth routes - Email/Password only
    log('Registering auth routes...');
    router.post('/api/auth/signup', asyncHandler(signUp));
    router.post('/api/auth/signin', asyncHandler(signIn));
    router.post('/api/auth/signout', asyncHandler(signOut));
    router.get('/api/auth/check', asyncHandler(checkAuth));
    router.get('/api/auth/check-admin', asyncHandler(checkAdmin));

    // User routes
    log('Registering user routes...');
    router.get('/api/user/theme', asyncHandler(getTheme));
    router.put('/api/user/theme', asyncHandler(updateTheme));
    router.get('/api/user/openai-key', asyncHandler(getOpenAIKey));
    router.put('/api/user/openai-key', asyncHandler(updateOpenAIKey));
    router.get('/api/user/api-stats', asyncHandler(getUserAPIStats));
    router.post('/api/user/test-openai', asyncHandler(testOpenAIEndpoint));
    router.post('/api/user/analyze-image', asyncHandler(analyzeImage));
    router.post('/api/user/generate-speech', asyncHandler(generateSpeech));
    router.post('/api/ai/translate', asyncHandler(translateText));

    // Admin routes
    log('Registering admin routes...');
    router.get('/api/admin/users', requireAdmin, asyncHandler(getUsers));
    router.put('/api/admin/users/:id', requireAdmin, asyncHandler(updateUser));
    router.put('/api/admin/users/:id/password', requireAdmin, asyncHandler(updateUserPassword));

    // Analytics routes
    log('Registering analytics routes...');
    router.use('/api/analytics', analyticsRoutes);

    // Proxy routes for external APIs
    log('Registering proxy routes...');
    router.use(proxyRoutes);

    // Error handling middleware
    router.use((err: any, req: any, res: any, next: any) => {
      log(`Route error: ${err.message}`);
      res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        status: err.status || 500
      });
    });

    // Use the router middleware
    app.use(router);
    log('All routes registered successfully');
  } catch (error) {
    log(`Fatal error registering routes: ${error}`);
    throw error;
  }
}
