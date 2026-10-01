import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from './auth.dto.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { authRateLimiter } from '../../middleware/rate-limit.middleware.js';

const router = Router();

router.post(
  '/register',
  authRateLimiter,
  validateBody(registerSchema),
  authController.register.bind(authController)
);

router.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  authController.login.bind(authController)
);

router.post(
  '/refresh',
  authRateLimiter,
  validateBody(refreshSchema),
  authController.refresh.bind(authController)
);

router.post(
  '/logout',
  validateBody(logoutSchema),
  authController.logout.bind(authController)
);

router.get(
  '/me',
  requireAuth,
  authController.me.bind(authController)
);

// GDPR complete user data wipe
router.delete(
  '/me',
  requireAuth,
  authController.deleteAccount.bind(authController)
);

router.delete(
  '/data',
  requireAuth,
  authController.deleteAccount.bind(authController)
);

export const authRoutes = router;
