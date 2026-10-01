import { Request, Response, NextFunction } from 'express';
import { tryOnService } from './try-on.service.js';
import { CreateTryOnJobInput, HistoryQueryInput } from './try-on.dto.js';

export class TryOnController {
  async createJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const input: CreateTryOnJobInput = req.body;
      const result = await tryOnService.createJob(userId, input);
      res.status(202).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getJobStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const jobId = req.params.id as string;
      const status = await tryOnService.getJobStatus(userId, jobId);
      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (err) {
      next(err);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const query = req.query as unknown as HistoryQueryInput;
      const history = await tryOnService.getHistory(userId, query);
      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (err) {
      next(err);
    }
  }

  async getResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const resultId = req.params.id as string;
      const result = await tryOnService.getResult(userId, resultId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const resultId = req.params.id as string;
      await tryOnService.deleteResult(userId, resultId);
      res.status(200).json({
        success: true,
        message: 'Try-on result deleted successfully.',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const tryOnController = new TryOnController();
