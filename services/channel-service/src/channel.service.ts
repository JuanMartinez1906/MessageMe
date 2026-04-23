import { AppError } from '@messageme/shared';
import { prisma } from './prisma';
import { groupRpc } from './group-client';

export interface ChannelDto {
  channelId: string;
  groupId: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

function toDto(row: {
  channelId: string;
  groupId: string;
  name: string;
  description: string | null;
  createdAt: Date;
}): ChannelDto {
  return { ...row };
}

async function requireGroupAdmin(groupId: string, userId: string): Promise<void> {
  const res = await groupRpc.listMembers({ groupId });
  const m = res.members.find((x) => x.userId === userId);
  if (!m) throw new AppError('FORBIDDEN', 'Not a member of this group');
  if (m.role !== 'ROLE_ADMIN') throw new AppError('FORBIDDEN', 'Only admins can manage channels');
}

export const channelService = {
  async createChannel(args: {
    groupId: string;
    name: string;
    description?: string;
    createdBy: string;
  }): Promise<ChannelDto> {
    if (!args.groupId || !args.name?.trim()) {
      throw new AppError('BAD_REQUEST', 'groupId and name are required');
    }
    await requireGroupAdmin(args.groupId, args.createdBy);
    const row = await prisma.channel.create({
      data: {
        groupId: args.groupId,
        name: args.name,
        description: args.description ?? null,
      },
    });
    return toDto(row);
  },

  async getChannel(channelId: string): Promise<ChannelDto> {
    const row = await prisma.channel.findUnique({ where: { channelId } });
    if (!row) throw new AppError('NOT_FOUND', 'Channel not found');
    return toDto(row);
  },

  async listChannels(groupId: string): Promise<ChannelDto[]> {
    const rows = await prisma.channel.findMany({
      where: { groupId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDto);
  },

  async updateChannel(args: {
    channelId: string;
    name?: string;
    description?: string;
  }): Promise<ChannelDto> {
    const exists = await prisma.channel.findUnique({ where: { channelId: args.channelId } });
    if (!exists) throw new AppError('NOT_FOUND', 'Channel not found');
    const row = await prisma.channel.update({
      where: { channelId: args.channelId },
      data: {
        name: args.name || undefined,
        description: args.description ?? undefined,
      },
    });
    return toDto(row);
  },

  async deleteChannel(channelId: string, requestedBy: string): Promise<void> {
    const channel = await prisma.channel.findUnique({ where: { channelId } });
    if (!channel) throw new AppError('NOT_FOUND', 'Channel not found');
    await requireGroupAdmin(channel.groupId, requestedBy);
    await prisma.channel.delete({ where: { channelId } });
  },
};
