import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { ProductCategory } from '@vton/shared';

// Load environment configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Standard Security & Body Parsing Middleware
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint (Assignment §13)
app.get(`${API_PREFIX}/health`, (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    categoriesSupported: Object.values(ProductCategory),
    services: {
      api: 'up',
      database: 'pending_connection',
      redis: 'pending_connection',
      storage: 'pending_connection',
      aiProvider: process.env.AI_PROVIDER || 'MOCK',
    },
  });
});

// Centralized Error Handling Middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled application error:', err);
  res.status(500).json({
    statusCode: 500,
    error: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
    timestamp: new Date().toISOString(),
  });
});

export function startServer() {
  return app.listen(PORT, () => {
    console.log(`[VTON Backend] Server running on http://localhost:${PORT}${API_PREFIX}`);
    console.log(`[VTON Backend] Health check available at http://localhost:${PORT}${API_PREFIX}/health`);
  });
}

// Start server if directly executed
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
