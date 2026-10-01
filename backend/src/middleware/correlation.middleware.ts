import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}
