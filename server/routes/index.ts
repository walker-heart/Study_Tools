import type { Express, Router } from "express";
import { signUp, signIn } from "./auth";

export function registerRoutes(app: Express): Router | void {
  // Auth routes with JWT
  app.post('/api/auth/signup', signUp);
  app.post('/api/auth/signin', signIn);
}
