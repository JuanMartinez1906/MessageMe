import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma';
import { config } from '../../config';
import { RegisterDto, LoginDto, AuthResponse, SafeUser, JwtPayload } from './auth.types';

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  isOnline: true,
  lastSeen: true,
  createdAt: true,
} as const;

function generateTokens(userId: string): { accessToken: string; refreshToken: string } {
  const accessToken = jwt.sign({ userId } as JwtPayload, config.jwtSecret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId } as JwtPayload, config.jwtRefreshSecret, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

export const authService = {
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) {
      throw new Error('Email or username already in use');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        password: hashed,
        displayName: dto.displayName,
        isOnline: true,
        lastSeen: new Date(),
      },
      select: USER_SELECT,
    });

    const tokens = generateTokens(user.id);
    return { user, ...tokens };
  },

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new Error('Invalid credentials');

    await prisma.user.update({
      where: { id: user.id },
      data: { isOnline: true, lastSeen: new Date() },
    });

    const safeUser: SafeUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isOnline: true,
      lastSeen: user.lastSeen,
      createdAt: user.createdAt,
    };

    const tokens = generateTokens(user.id);
    return { user: safeUser, ...tokens };
  },

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: JwtPayload;
    try {
      payload = jwt.verify(refreshToken, config.jwtRefreshSecret) as JwtPayload;
    } catch {
      throw new Error('Invalid or expired refresh token');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new Error('User not found');

    const accessToken = jwt.sign({ userId: user.id } as JwtPayload, config.jwtSecret, { expiresIn: '15m' });
    return { accessToken };
  },

  async logout(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { isOnline: false, lastSeen: new Date() },
    });
  },

  async me(userId: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });
    if (!user) throw new Error('User not found');
    return user;
  },
};
