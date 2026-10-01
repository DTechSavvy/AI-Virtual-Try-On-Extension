import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('chrome-extension://*'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),

  // Object Storage (S3 / MinIO)
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_PORT: z.coerce.number().default(9000),
  S3_USE_SSL: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  S3_ACCESS_KEY: z.string().default('S3RVER'),
  S3_SECRET_KEY: z.string().default('S3RVER'),
  S3_BUCKET_NAME: z.string().default('vton-private'),
  S3_REGION: z.string().default('us-east-1'),
  S3_FORCE_PATH_STYLE: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(16).default('super_secret_jwt_access_key_change_in_production_min_32_chars'),
  JWT_REFRESH_SECRET: z.string().min(16).default('super_secret_jwt_refresh_key_change_in_production_min_32_chars'),
  JWT_ACCESS_EXPIRES_IN: z.coerce.number().default(900), // 15 mins
  JWT_REFRESH_EXPIRES_IN: z.coerce.number().default(604800), // 7 days

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // AI Providers & Queue
  AI_PROVIDER: z.enum(['MOCK', 'FASHN', 'REPLICATE', 'IMAGEN', 'IDM_VTON']).default('IDM_VTON'),
  FASHN_API_KEY: z.string().optional().default(''),
  FASHN_API_URL: z.string().default('https://api.fashn.ai/v1'),
  FASHN_MODEL: z.string().default('tryon-max'),
  FASHN_TIMEOUT_SECONDS: z.coerce.number().default(90),
  REPLICATE_API_TOKEN: z.string().optional().default(''),
  TRYON_QUEUE_NAME: z.string().default('vton-try-on-jobs'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration validation failed');
}

export const env = parsed.data;
