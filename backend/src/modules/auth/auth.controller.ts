import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { RegisterInput, LoginInput, RefreshInput, LogoutInput } from './auth.dto.js';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: RegisterInput = req.body;
      const result = await authService.register(input);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: LoginInput = req.body;
      const userAgent = req.headers['user-agent'];
      const result = await authService.login(input, userAgent);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: RefreshInput = req.body;
      const userAgent = req.headers['user-agent'];
      const tokens = await authService.refresh(input.refreshToken, userAgent);
      res.status(200).json({
        success: true,
        data: { tokens },
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: LogoutInput = req.body;
      await authService.logout(input.refreshToken, req.user?.id);
      res.status(200).json({
        success: true,
        message: 'Successfully logged out.',
      });
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const userSummary = await authService.getMe(userId);
      res.status(200).json({
        success: true,
        data: { user: userSummary },
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      await authService.deleteUserData(userId);
      res.status(200).json({
        success: true,
        message: 'Account, digital profile, photos, and generated try-on data permanently deleted.',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
