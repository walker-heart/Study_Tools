import { Router, Request, Response, NextFunction } from "express";
import { signUp, signIn, signOut, checkAuth } from "./auth";

export function registerRoutes(): Router {
  const router = Router();

  // Wrap route handlers with proper error handling
  const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        await fn(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  };

  // Auth routes - Email/Password only
  router.post('/api/auth/signup', asyncHandler(signUp));
  router.post('/api/auth/signin', asyncHandler(signIn));
  router.post('/api/auth/signout', asyncHandler(signOut));
  router.get('/api/auth/check', asyncHandler(checkAuth));

  return router;
}
