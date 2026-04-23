import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { AppError, grpcErrorToApp } from '@messageme/shared';
import * as grpc from '@grpc/grpc-js';
import { config } from './config';
import { prisma } from './prisma';
import { userRpc } from './user-client';

interface AccessPayload {
  userId: string;
}

interface RefreshPayload {
  userId: string;
  tokenId: string;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(userId: string): { token: string; expiresAt: Date } {
  const token = jwt.sign({ userId } satisfies AccessPayload, config.jwtSecret, {
    expiresIn: config.accessTtlSeconds,
  });
  return { token, expiresAt: new Date(Date.now() + config.accessTtlSeconds * 1000) };
}

function signRefreshToken(userId: string, tokenId: string): string {
  return jwt.sign({ userId, tokenId } satisfies RefreshPayload, config.jwtRefreshSecret, {
    expiresIn: config.refreshTtlSeconds,
  });
}

async function issueRefreshToken(userId: string): Promise<string> {
  const tokenId = uuidv4();
  const refresh = signRefreshToken(userId, tokenId);
  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      tokenHash: hashToken(refresh),
      userId,
      expiresAt: new Date(Date.now() + config.refreshTtlSeconds * 1000),
    },
  });
  return refresh;
}

export interface RegisterArgs {
  email: string;
  username: string;
  password: string;
  displayName: string;
}

export interface AuthResult {
  userId: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
}

export const authService = {
  async register(args: RegisterArgs): Promise<AuthResult> {
    if (!args.email || !args.username || !args.password || !args.displayName) {
      throw new AppError('BAD_REQUEST', 'email, username, password, displayName are required');
    }
    if (args.password.length < 6) {
      throw new AppError('BAD_REQUEST', 'Password must be at least 6 characters');
    }

    const existing = await prisma.userAuth.findUnique({ where: { email: args.email } });
    if (existing) throw new AppError('CONFLICT', 'Email already in use');

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(args.password, config.bcryptRounds);

    // Create profile first; if username is taken, user-service returns CONFLICT
    // and we fail-fast without touching our own table.
    try {
      await userRpc.createProfile({
        userId,
        email: args.email,
        username: args.username,
        displayName: args.displayName,
      });
    } catch (err) {
      throw grpcErrorToApp(err as grpc.ServiceError);
    }

    await prisma.userAuth.create({
      data: { userId, email: args.email, passwordHash },
    });

    const { token: accessToken, expiresAt: accessExpiresAt } = signAccessToken(userId);
    const refreshToken = await issueRefreshToken(userId);
    return { userId, accessToken, refreshToken, accessExpiresAt };
  },

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await prisma.userAuth.findUnique({ where: { email } });
    if (!user) throw new AppError('UNAUTHENTICATED', 'Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError('UNAUTHENTICATED', 'Invalid credentials');

    const { token: accessToken, expiresAt: accessExpiresAt } = signAccessToken(user.userId);
    const refreshToken = await issueRefreshToken(user.userId);
    return { userId: user.userId, accessToken, refreshToken, accessExpiresAt };
  },

  async refresh(refreshToken: string): Promise<AuthResult> {
    let payload: RefreshPayload;
    try {
      payload = jwt.verify(refreshToken, config.jwtRefreshSecret) as RefreshPayload;
    } catch {
      throw new AppError('UNAUTHENTICATED', 'Invalid or expired refresh token');
    }

    const stored = await prisma.refreshToken.findUnique({ where: { id: payload.tokenId } });
    if (!stored || stored.revokedAt || stored.tokenHash !== hashToken(refreshToken)) {
      throw new AppError('UNAUTHENTICATED', 'Refresh token not recognized');
    }
    if (stored.expiresAt < new Date()) {
      throw new AppError('UNAUTHENTICATED', 'Refresh token expired');
    }

    // Rotate: revoke old, issue new.
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const { token: accessToken, expiresAt: accessExpiresAt } = signAccessToken(payload.userId);
    const newRefresh = await issueRefreshToken(payload.userId);
    return { userId: payload.userId, accessToken, refreshToken: newRefresh, accessExpiresAt };
  },

  async logout(refreshToken: string): Promise<void> {
    let payload: RefreshPayload;
    try {
      payload = jwt.verify(refreshToken, config.jwtRefreshSecret) as RefreshPayload;
    } catch {
      return;
    }
    await prisma.refreshToken
      .update({ where: { id: payload.tokenId }, data: { revokedAt: new Date() } })
      .catch(() => void 0);
  },

  async validateToken(accessToken: string): Promise<{ userId: string; expiresAt: Date }> {
    try {
      const payload = jwt.verify(accessToken, config.jwtSecret) as AccessPayload & { exp: number };
      return { userId: payload.userId, expiresAt: new Date(payload.exp * 1000) };
    } catch {
      throw new AppError('UNAUTHENTICATED', 'Invalid or expired access token');
    }
  },
};
