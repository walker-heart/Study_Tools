import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes/index";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import { type ErrorWithStatus } from "./types/express";
import cors from "cors";
import session from "express-session";
import { sessionConfig } from "./config/session";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { env } from "./lib/env";
import { initializePassport, initializeSession } from "./auth/passport";

function log(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [express] ${message}`);
}

const app = express();

// Configure CORS middleware
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session(sessionConfig));

// Initialize passport after session
app.use(initializePassport());
app.use(initializeSession());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

(async () => {
  try {
    // Verify database connection
    await db.execute(sql`SELECT 1`);
    log('Database connection successful');

    // Register routes
    const router = registerRoutes();
    app.use(router);
    
    const server = createServer(app);

    // Error handling middleware
    app.use((err: ErrorWithStatus, req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      res.status(status).json({ message });
      next();
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
      app.get('*', (_req, res) => {
        res.sendFile('index.html', { root: './dist' });
      });
    }

    const PORT = parseInt(process.env.PORT || '5000', 10);
    server.listen({
      port: PORT,
      host: '0.0.0.0'
    }, () => {
      log(`Server running in ${app.get("env")} mode on port ${PORT}`);
      log(`APP_URL: ${env.APP_URL}`);
    });
  } catch (error) {
    log(`Fatal error: ${error}`);
    process.exit(1);
  }
})();