import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const formattedErrors = formatZodErrors(result.error);
      const firstReason = formattedErrors[0]?.reason;
      res.status(400).json({
        type: 'https://api.vton.internal/errors/validation-error',
        title: 'Validation Error',
        status: 400,
        detail: firstReason || 'The request body contains invalid or missing fields.',
        invalidParams: formattedErrors,
        correlationId: req.correlationId,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const formattedErrors = formatZodErrors(result.error);
      const firstReason = formattedErrors[0]?.reason;
      res.status(400).json({
        type: 'https://api.vton.internal/errors/validation-error',
        title: 'Validation Error',
        status: 400,
        detail: firstReason || 'The query parameters contain invalid or missing fields.',
        invalidParams: formattedErrors,
        correlationId: req.correlationId,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    req.query = result.data;
    next();
  };
}

function formatZodErrors(error: ZodError) {
  return error.errors.map((err) => ({
    name: err.path.join('.'),
    reason: err.message,
  }));
}
