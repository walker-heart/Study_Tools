#!/bin/bash

# Save this as setup-error-handling.sh
# Then run: chmod +x setup-error-handling.sh && ./setup-error-handling.sh

# Create necessary directories
mkdir -p server/middleware
mkdir -p server/utils
mkdir -p server/types

# Create error handling middleware
cat > server/middleware/errorHandling.ts << 'EOL'
import { Request, Response, NextFunction } from "express";

export interface ApiError extends Error {
  statusCode?: number;
  details?: any;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path
  });

  res.status(err.statusCode || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message
  });
};

export const asyncHandler = (fn: Function) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  Promise.resolve(fn(req, res, next)).catch((error: ApiError) => {
    error.statusCode = error.statusCode || 500;
    next(error);
  });
};

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
  });
  next();
};
EOL

# Create database error utilities
cat > server/utils/dbErrors.ts << 'EOL'
export async function testDatabaseConnection(sql: any) {
  try {
    const result = await sql`SELECT NOW()`;
    console.log('Database connection successful:', result[0].now);
    return true;
  } catch (error) {
    console.error('Database Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });

    throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
EOL

# Create session types
cat > server/types/session.d.ts << 'EOL'
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number;
      email: string;
      isAdmin?: boolean;
    };
    authenticated?: boolean;
  }
}

declare module 'express' {
  interface Request {
    session: SessionData;
  }
}

export {};
EOL

# Update vite.ts
sed -i '1i import { errorHandler, requestLogger } from "./middleware/errorHandling";' server/vite.ts
sed -i '/app.use(express.static(distPath));/i \ \ app.use(requestLogger);' server/vite.ts
sed -i '/app.use(express.static(distPath));/a \ \ app.use(errorHandler);' server/vite.ts

# Update package.json to add types
npmDeps="@types/express @types/express-session typescript"
if ! npm list $npmDeps >/dev/null 2>&1; then
  npm install --save-dev $npmDeps
fi

# Create an example route with error handling
mkdir -p server/routes
cat > server/routes/example.ts << 'EOL'
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandling';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  session: {
    user?: {
      id: number;
      email: string;
      isAdmin?: boolean;
    };
    authenticated?: boolean;
  };
}

const router = Router();

router.get('/protected', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.session.authenticated) {
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }
  
  res.json({ message: 'Protected route accessed successfully' });
}));

export default router;
EOL

echo "Error handling system has been set up successfully!"
echo "Next steps:"
echo "1. Update your route files to use asyncHandler"
echo "2. Import the error handling middleware in your main app file"
echo "3. Restart your server"
echo ""
echo "Example usage in routes:"
echo "import { asyncHandler } from '../middleware/errorHandling';"
echo "router.get('/path', asyncHandler(async (req, res) => { ... }));"