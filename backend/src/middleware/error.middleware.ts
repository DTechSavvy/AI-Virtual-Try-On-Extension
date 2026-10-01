import { Request, Response, NextFunction } from 'express';
import { AuthError } from '../modules/auth/auth.service.js';
import { ProfileError } from '../modules/profiles/profile.service.js';
import { TryOnError } from '../modules/try-on/try-on.service.js';
import { ImagePreprocessingError } from '../services/image.service.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const correlationId = req.correlationId || 'unknown';

  logger.error(
    {
      err: {
        name: err.name,
        message: err.message,
        stack: env.NODE_ENV !== 'production' ? err.stack : undefined,
      },
      correlationId,
      path: req.path,
      method: req.method,
    },
    'Request processing failed'
  );

  if (err instanceof AuthError) {
    res.status(err.statusCode).json({
      success: false,
      type: `https://api.vton.internal/errors/${err.code.toLowerCase().replace(/_/g, '-')}`,
      title: 'Authentication Error',
      status: err.statusCode,
      detail: err.message,
      error: {
        code: err.code,
        message: err.message,
      },
      correlationId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (err instanceof TryOnError) {
    res.status(err.statusCode).json({
      success: false,
      type: `https://api.vton.internal/errors/${err.code.toLowerCase().replace(/_/g, '-')}`,
      title: 'Virtual Try-On Error',
      status: err.statusCode,
      detail: err.message,
      error: {
        code: err.code,
        message: err.message,
      },
      correlationId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (err instanceof ProfileError) {
    res.status(err.statusCode).json({
      success: false,
      type: `https://api.vton.internal/errors/${err.code.toLowerCase().replace(/_/g, '-')}`,
      title: 'Digital Profile Error',
      status: err.statusCode,
      detail: err.message,
      error: {
        code: err.code,
        message: err.message,
      },
      correlationId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (err instanceof ImagePreprocessingError) {
    res.status(400).json({
      type: `https://api.vton.internal/errors/${err.code.toLowerCase().replace(/_/g, '-')}`,
      title: 'Image Preprocessing Error',
      status: 400,
      detail: err.message,
      correlationId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Multer errors (e.g. file too large)
  if (err.name === 'MulterError') {
    res.status(400).json({
      type: 'https://api.vton.internal/errors/file-upload-error',
      title: 'File Upload Error',
      status: 400,
      detail: err.message,
      correlationId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Generic internal server error (RFC 7807)
  const isDev = env.NODE_ENV !== 'production';
  res.status(500).json({
    type: 'https://api.vton.internal/errors/internal-server-error',
    title: 'Internal Server Error',
    status: 500,
    detail: isDev ? err.message : 'An unexpected server error occurred. Please try again later.',
    correlationId,
    timestamp: new Date().toISOString(),
  });
}
