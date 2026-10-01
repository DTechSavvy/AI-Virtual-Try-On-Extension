import { Router } from 'express';
import { tryOnController } from './try-on.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validation.middleware.js';
import { createTryOnJobSchema, historyQuerySchema } from './try-on.dto.js';
import { tryOnRateLimiter } from '../../middleware/rate-limit.middleware.js';

const router = Router();

// Submit new try-on job
router.post(
  '/jobs',
  requireAuth,
  tryOnRateLimiter,
  validateBody(createTryOnJobSchema),
  tryOnController.createJob.bind(tryOnController)
);

// Alias: POST / (according to spec POST /try-on)
router.post(
  '/',
  requireAuth,
  tryOnRateLimiter,
  validateBody(createTryOnJobSchema),
  tryOnController.createJob.bind(tryOnController)
);

// Poll job status
router.get(
  '/jobs/:id',
  requireAuth,
  tryOnController.getJobStatus.bind(tryOnController)
);

// Results history (both /results and /history)
router.get(
  '/history',
  requireAuth,
  validateQuery(historyQuerySchema),
  tryOnController.getHistory.bind(tryOnController)
);

router.get(
  '/results',
  requireAuth,
  validateQuery(historyQuerySchema),
  tryOnController.getHistory.bind(tryOnController)
);

// Single result
router.get(
  '/results/:id',
  requireAuth,
  tryOnController.getResult.bind(tryOnController)
);

// Delete result
router.delete(
  '/results/:id',
  requireAuth,
  tryOnController.deleteResult.bind(tryOnController)
);

// Fallback alias: GET /:id (placed at the end to prevent shadow of static sub-routes)
router.get(
  '/:id',
  requireAuth,
  tryOnController.getJobStatus.bind(tryOnController)
);

export const tryOnRoutes = router;
