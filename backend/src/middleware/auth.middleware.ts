import { Request, Response, NextFunction } from 'express';
import { authService, AuthError } from '../modules/auth/auth.service.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      type: 'https://api.vton.internal/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Missing or malformed Authorization Bearer header.',
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const token = authHeader.substring(7).trim();

  try {
    const payload = authService.verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (err: unknown) {
    const message = err instanceof AuthError ? err.message : 'Invalid or expired access token.';
    res.status(401).json({
      type: 'https://api.vton.internal/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: message,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    });
  }
}
