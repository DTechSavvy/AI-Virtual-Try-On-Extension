import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 20, // max 20 auth attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'https://api.vton.internal/errors/rate-limited',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Too many authentication attempts. Please try again later.',
  },
  skip: () => env.NODE_ENV === 'test', // Skip in automated tests for predictable execution
});

export const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
});

export const tryOnRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 15, // max 15 try-on requests per minute per IP to protect AI compute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'https://api.vton.internal/errors/rate-limited',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Too many virtual try-on requests. Please wait a moment before submitting again.',
  },
  skip: () => env.NODE_ENV === 'test',
});
