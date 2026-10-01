import { Router } from 'express';
import { productController } from './product.controller.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { normalizeProductSchema } from './product.dto.js';

const router = Router();

router.post(
  '/normalize',
  validateBody(normalizeProductSchema),
  productController.normalizeProduct.bind(productController)
);

export const productRoutes = router;
