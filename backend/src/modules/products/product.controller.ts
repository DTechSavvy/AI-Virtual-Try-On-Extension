import { Request, Response, NextFunction } from 'express';
import { productService } from './product.service.js';
import { NormalizeProductInput } from './product.dto.js';

export class ProductController {
  async normalizeProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: NormalizeProductInput = req.body;
      const result = await productService.normalizeProduct(input);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const productController = new ProductController();
