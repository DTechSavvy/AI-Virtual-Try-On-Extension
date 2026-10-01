import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { checkDatabaseHealth } from './config/database.js';
import { checkRedisHealth } from './config/redis.js';
import { storageService } from './services/storage.service.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { profileRoutes } from './modules/profiles/profile.routes.js';
import { productRoutes } from './modules/products/product.routes.js';
import { tryOnRoutes } from './modules/try-on/try-on.routes.js';
import { providerRegistry } from './modules/try-on/providers/provider.registry.js';
import { correlationMiddleware } from './middleware/correlation.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { ProductCategory } from '@vton/shared';

const app = express();
const PORT = env.PORT;
const API_PREFIX = env.API_PREFIX;

// 1. Security Headers
app.use(helmet());

// 2. Controlled CORS Configuration (Extension + Local Development)
const allowedOrigins = [
  /^chrome-extension:\/\/[a-z0-9]+$/,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4000',
  'http://127.0.0.1:4000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.some((allowed) =>
        typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
      );
      if (isAllowed || env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
  })
);

// 3. Correlation ID & Body Parsing
app.use(correlationMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Live Health Check Endpoint
app.get(`${API_PREFIX}/health`, async (_req: Request, res: Response) => {
  const [dbHealth, redisHealth, storageHealth, providerHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    storageService.checkHealth(),
    providerRegistry.checkActiveProviderHealth().catch((err) => ({
      provider: env.AI_PROVIDER,
      status: 'down' as const,
      latencyMs: undefined,
      error: err.message,
    })),
  ]);

  const coreHealthy =
    dbHealth.status === 'up' &&
    redisHealth.status === 'up' &&
    storageHealth.status === 'up';

  res.status(coreHealthy ? 200 : 207).json({
    status: coreHealthy && providerHealth.status === 'up' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    categoriesSupported: Object.values(ProductCategory),
    services: {
      api: 'up',
      database: dbHealth.status,
      redis: redisHealth.status,
      storage: storageHealth.status,
      aiProvider: providerHealth.provider,
      aiProviderStatus: providerHealth.status,
    },
    diagnostics: {
      dbLatencyMs: dbHealth.latencyMs,
      redisLatencyMs: redisHealth.latencyMs,
      storageLatencyMs: storageHealth.latencyMs,
      aiLatencyMs: providerHealth.latencyMs,
    },
  });
});

// 5. Mount API Routes
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/user`, authRoutes); // Supports /api/v1/user/data & /api/v1/user/me
app.use(`${API_PREFIX}/profile`, profileRoutes);
app.use(`${API_PREFIX}/products`, productRoutes);
app.use(`${API_PREFIX}/try-on`, tryOnRoutes);

// 5.5 Serve local/dev mock object storage assets (pre-signed URL fallback)
app.get(`${API_PREFIX}/storage/mock/*`, async (req: Request, res: Response) => {
  try {
    const rawParam = (req.params as any)[0] || '';
    const key = rawParam.includes('%') ? decodeURIComponent(rawParam) : rawParam;

    const itemBuffer = await storageService.getObjectBuffer(key);
    const meta = await storageService.getMetadata(key);

    res.setHeader('Content-Type', meta?.contentType || 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(itemBuffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Asset not found';
    logger.warn({ url: req.url, error: msg }, '[ObjectStorage] Could not retrieve mock storage asset');
    res.status(404).json({ success: false, error: 'Asset not found in storage' });
  }
});

// 6. Centralized Error Handling Middleware (RFC 7807)
app.use(errorHandler);

export async function initServices() {
  await storageService.ensureBucketExists();
}

export function startServer() {
  return app.listen(PORT, async () => {
    logger.info(`[VTON Backend] Server running on http://localhost:${PORT}${API_PREFIX}`);
    logger.info(`[VTON Backend] Health check available at http://localhost:${PORT}${API_PREFIX}/health`);
    await initServices();
  });
}

// Start server if directly executed (non-test)
if (env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
