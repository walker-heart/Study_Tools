import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes/index";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";
import cors from "cors";
import session from "express-session";
import { sessionConfig } from "./config/session";
import { db } from "./db";
import { sql } from "drizzle-orm";

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
  origin: (origin, callback) => {
    if (!origin) {
      // Allow requests with no origin
      callback(null, true);
      return;
    }

    try {
      const url = new URL(origin);
      const hostname = url.hostname.toLowerCase();
      
      log(`Processing request from origin: ${origin}`);
      
      // Define allowed domains
      const allowedDomains = [
        '.repl.co',
        '.replit.dev',
        '.preview.app.github.dev',
        'accounts.google.com',
        'oauth2.googleapis.com',
        'www.googleapis.com',
        'googleapis.com',
        'google.com',
        'localhost'
      ];

      // Check if the hostname matches or ends with any allowed domain
      const isAllowed = allowedDomains.some(domain => 
        hostname === domain || 
        hostname.endsWith(domain) || 
        hostname.endsWith('.repl.co') ||
        hostname.endsWith('.id.repl.co')
      );

      if (isAllowed) {
        log(`Allowing CORS for: ${hostname}`);
        callback(null, true);
        return;
      }
      
      log(`CORS blocked for: ${hostname}`);
      callback(new Error('Not allowed by CORS'));
    } catch (error) {
      log(`Origin parsing error: ${error}`);
      callback(new Error('Invalid origin'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials'
  ],
  exposedHeaders: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials']
}));

// Add pre-flight OPTIONS handling
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session(sessionConfig));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Verify database connection
    try {
      await db.execute(sql`SELECT 1`);
      log('Database connection successful');
    } catch (error) {
      log('Error connecting to database: ' + error);
      process.exit(1);
    }

    // Check for required environment variables
    if (!process.env.JWT_SECRET) {
      log('Error: JWT_SECRET is not set. Authentication will not work properly.');
      process.exit(1);
    }

    if (!process.env.DATABASE_URL) {
      log('Error: DATABASE_URL is not set. Database connections will fail.');
      process.exit(1);
    }

    registerRoutes(app);
    const server = createServer(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      log(`Error: ${message}`);
      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on port 5000
    // this serves both the API and the client
    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`serving on port ${PORT}`);
    });
  } catch (error) {
    log(`Fatal error: ${error}`);
    process.exit(1);
  }
})();
