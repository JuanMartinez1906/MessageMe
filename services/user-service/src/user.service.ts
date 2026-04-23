import { AppError } from '@messageme/shared';
import { prisma } from './prisma';

export interface ProfileDto {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
}

function toDto(row: {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
}): ProfileDto {
  return {
    userId: row.userId,
    email: row.email,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt,
  };
}

export const userService = {
  async createProfile(args: {
    userId: string;
    email: string;
    username: string;
    displayName: string;
  }): Promise<ProfileDto> {
    if (!args.userId || !args.email || !args.username || !args.displayName) {
      throw new AppError('BAD_REQUEST', 'Missing required fields');
    }
    const clash = await prisma.userProfile.findFirst({
      where: { OR: [{ username: args.username }, { email: args.email }] },
    });
    if (clash) throw new AppError('CONFLICT', 'Username or email already in use');

    const row = await prisma.userProfile.create({
      data: {
        userId: args.userId,
        email: args.email,
        username: args.username,
        displayName: args.displayName,
      },
    });
    return toDto(row);
  },

  async getProfile(userId: string): Promise<ProfileDto> {
    const row = await prisma.userProfile.findUnique({ where: { userId } });
    if (!row) throw new AppError('NOT_FOUND', 'User not found');
    return toDto(row);
  },

  async getProfiles(userIds: string[]): Promise<ProfileDto[]> {
    if (userIds.length === 0) return [];
    const rows = await prisma.userProfile.findMany({ where: { userId: { in: userIds } } });
    return rows.map(toDto);
  },

  async search(query: string, limit: number): Promise<ProfileDto[]> {
    const q = (query ?? '').trim();
    if (q.length < 2) return [];
    const rows = await prisma.userProfile.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { username: 'asc' },
      take: Math.min(Math.max(limit, 1), 50),
    });
    return rows.map(toDto);
  },

  async updateProfile(args: {
    userId: string;
    displayName?: string;
    avatarUrl?: string;
  }): Promise<ProfileDto> {
    const exists = await prisma.userProfile.findUnique({ where: { userId: args.userId } });
    if (!exists) throw new AppError('NOT_FOUND', 'User not found');

    const row = await prisma.userProfile.update({
      where: { userId: args.userId },
      data: {
        displayName: args.displayName ?? undefined,
        avatarUrl: args.avatarUrl ?? undefined,
      },
    });
    return toDto(row);
  },
};
