import { prisma } from '../../config/prisma';
import { CreateGroupDto, CreateChannelDto } from './groups.types';

const MEMBER_SELECT = {
  id: true,
  role: true,
  joinedAt: true,
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isOnline: true } },
};

const CHANNEL_SELECT = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
};

async function requireMember(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!member) throw new Error('You are not a member of this group');
  return member;
}

async function requireAdmin(groupId: string, userId: string) {
  const member = await requireMember(groupId, userId);
  if (member.role !== 'ADMIN') throw new Error('Only admins can perform this action');
  return member;
}

export const groupsService = {
  async createGroup(userId: string, dto: CreateGroupDto) {
    const group = await prisma.group.create({
      data: {
        name: dto.name,
        description: dto.description,
        createdById: userId,
        members: {
          create: { userId, role: 'ADMIN' },
        },
        channels: {
          create: { name: 'general', description: 'Canal general del grupo' },
        },
      },
      include: {
        members: { select: MEMBER_SELECT },
        channels: { select: CHANNEL_SELECT },
      },
    });
    return group;
  },

  async getGroups(userId: string) {
    return prisma.group.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { select: MEMBER_SELECT },
        channels: { select: CHANNEL_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getGroupById(groupId: string, userId: string) {
    await requireMember(groupId, userId);
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { select: MEMBER_SELECT },
        channels: { select: CHANNEL_SELECT },
      },
    });
    if (!group) throw new Error('Group not found');
    return group;
  },

  async addMember(groupId: string, requesterId: string, targetUserId: string) {
    await requireAdmin(groupId, requesterId);

    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new Error('User not found');

    const existing = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });
    if (existing) throw new Error('User is already a member');

    return prisma.groupMember.create({
      data: { userId: targetUserId, groupId, role: 'MEMBER' },
      select: MEMBER_SELECT,
    });
  },

  async removeMember(groupId: string, requesterId: string, targetUserId: string) {
    await requireAdmin(groupId, requesterId);

    const target = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });
    if (!target) throw new Error('User is not a member of this group');

    await prisma.groupMember.delete({
      where: { userId_groupId: { userId: targetUserId, groupId } },
    });
  },

  async createChannel(groupId: string, userId: string, dto: CreateChannelDto) {
    await requireAdmin(groupId, userId);
    return prisma.channel.create({
      data: { name: dto.name, description: dto.description, groupId },
      select: CHANNEL_SELECT,
    });
  },

  async getChannels(groupId: string, userId: string) {
    await requireMember(groupId, userId);
    return prisma.channel.findMany({
      where: { groupId },
      select: CHANNEL_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  },

  async deleteChannel(groupId: string, channelId: string, userId: string) {
    await requireAdmin(groupId, userId);

    const channel = await prisma.channel.findFirst({ where: { id: channelId, groupId } });
    if (!channel) throw new Error('Channel not found');

    await prisma.messageStatus.deleteMany({ where: { message: { channelId } } });
    await prisma.message.deleteMany({ where: { channelId } });
    await prisma.channel.delete({ where: { id: channelId } });
  },
};
