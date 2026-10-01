import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { RegisterInput, LoginInput } from './auth.dto.js';
import { AuthResponse, UserSummary, AuthTokens } from '@vton/shared';
import { storageService } from '../../services/storage.service.js';
import { logger } from '../../utils/logger.js';

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'AUTH_ERROR',
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export class AuthService {
  private readonly saltRounds = 12;

  /**
   * Register a new user and generate initial digital profile.
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      throw new AuthError('An account with this email address already exists.', 'EMAIL_ALREADY_EXISTS', 409);
    }

    const passwordHash = await bcrypt.hash(input.password, this.saltRounds);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          displayName: input.displayName || null,
          consentTraining: input.consentTraining,
        },
      });

      // Automatically create a default digital profile for new users
      await tx.digitalProfile.create({
        data: {
          userId: newUser.id,
          name: 'Default Profile',
          isDefault: true,
        },
      });

      return newUser;
    });

    logger.info({ userId: user.id }, 'User registered successfully with default profile');

    const tokens = await this.generateTokenPair(user.id, user.email, user.role);

    return {
      user: this.toUserSummary(user),
      tokens,
    };
  }

  /**
   * Authenticate an existing user with email and password.
   */
  async login(input: LoginInput, userAgent?: string): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user || user.deletedAt) {
      throw new AuthError('Invalid email or password.', 'INVALID_CREDENTIALS', 401);
    }

    const validPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!validPassword) {
      throw new AuthError('Invalid email or password.', 'INVALID_CREDENTIALS', 401);
    }

    const tokens = await this.generateTokenPair(user.id, user.email, user.role, userAgent);
    logger.info({ userId: user.id }, 'User logged in successfully');

    return {
      user: this.toUserSummary(user),
      tokens,
    };
  }

  /**
   * Refresh session with token rotation.
   */
  async refresh(refreshTokenStr: string, userAgent?: string): Promise<AuthTokens> {
    try {
      jwt.verify(refreshTokenStr, env.JWT_REFRESH_SECRET);
    } catch {
      throw new AuthError('Invalid or expired refresh token.', 'INVALID_REFRESH_TOKEN', 401);
    }

    const tokenHash = this.hashToken(refreshTokenStr);

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date() || tokenRecord.user.deletedAt) {
      // Possible token reuse attack or expired token: delete any record
      if (tokenRecord) {
        await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
      }
      throw new AuthError('Refresh token is invalid or has expired.', 'INVALID_REFRESH_TOKEN', 401);
    }

    // Refresh token rotation: delete the used refresh token and issue a fresh pair
    await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });

    const newTokens = await this.generateTokenPair(
      tokenRecord.user.id,
      tokenRecord.user.email,
      tokenRecord.user.role,
      userAgent
    );

    return newTokens;
  }

  /**
   * Revoke refresh token on logout.
   */
  async logout(refreshTokenStr?: string, userId?: string): Promise<void> {
    if (refreshTokenStr) {
      const tokenHash = this.hashToken(refreshTokenStr);
      await prisma.refreshToken.deleteMany({
        where: { tokenHash },
      });
    } else if (userId) {
      await prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }
  }

  /**
   * Retrieve current user profile summary by ID.
   */
  async getMe(userId: string): Promise<UserSummary> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      throw new AuthError('User not found or account deactivated.', 'USER_NOT_FOUND', 404);
    }

    return this.toUserSummary(user);
  }

  /**
   * Complete GDPR deletion: purges all private S3 objects (profile photos and try-on results)
   * and cascades database removal of user account and related records.
   */
  async deleteUserData(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AuthError('User not found.', 'USER_NOT_FOUND', 404);
    }

    // 1. Purge private objects in S3
    try {
      await storageService.deletePrefix(`profiles/${userId}/`);
      await storageService.deletePrefix(`results/${userId}/`);
      logger.info({ userId }, '[AuthService] Purged S3 storage for user data wipe');
    } catch (err) {
      logger.error({ err, userId }, '[AuthService] Error deleting user S3 prefix; continuing DB purge');
    }

    // 2. Cascade delete database user record
    await prisma.user.delete({
      where: { id: userId },
    });

    logger.info({ userId }, '[AuthService] User account and records wiped successfully');
  }

  /**
   * Verify an access token and return decoded payload.
   */
  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid access token';
      throw new AuthError(message, 'UNAUTHORIZED', 401);
    }
  }

  private async generateTokenPair(
    userId: string,
    email: string,
    role: string,
    userAgent?: string
  ): Promise<AuthTokens> {
    const accessToken = jwt.sign(
      { sub: userId, email, role },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
    );

    const tokenId = crypto.randomUUID();
    const refreshToken = jwt.sign(
      { sub: userId, jti: tokenId },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
    );

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_IN * 1000);

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        userAgent: userAgent || null,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private toUserSummary(user: {
    id: string;
    email: string;
    displayName: string | null;
    role: string;
    consentTraining: boolean;
    createdAt: Date;
  }): UserSummary {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName || undefined,
      role: user.role,
      consentTraining: user.consentTraining,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

export const authService = new AuthService();
