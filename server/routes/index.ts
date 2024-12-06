import { Express } from "express";
import { signUp, signIn } from "./auth";

export function registerRoutes(app: Express) {
  // Auth routes
  app.post('/api/auth/signup', signUp);
  app.post('/api/auth/signin', signIn);
}
