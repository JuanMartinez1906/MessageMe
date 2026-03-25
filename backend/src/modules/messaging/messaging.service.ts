import { MessageType } from '@prisma/client';
import { prisma } from '../../config/prisma';

const SENDER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
};

const MESSAGE_INCLUDE = {
  sender: { select: SENDER_SELECT },
  statuses: {
    select: { userId: true, status: true, updatedAt: true },
  },
};

async function getChannelGroup(channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { groupId: true },
  });
  if (!channel) throw new Error('Channel not found');
  return channel.groupId;
}

async function requireChannelMember(channelId: string, userId: string) {
  const groupId = await getChannelGroup(channelId);
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!member) throw new Error('You are not a member of this channel');
  return { groupId, member };
}

export const messagingService = {
  async getMessages(channelId: string, userId: string, cursor?: string) {
    await requireChannelMember(channelId, userId);

    const messages = await prisma.message.findMany({
      where: { channelId },
      include: MESSAGE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 50,
      ...(cursor
        ? { skip: 1, cursor: { id: cursor } }
        : {}),
    });

    return messages.reverse();
  },

  async getRecentMessages(channelId: string, limit = 20) {
    const messages = await prisma.message.findMany({
      where: { channelId },
      include: MESSAGE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse();
  },

  async deleteMessage(messageId: string, channelId: string, userId: string) {
    const { groupId } = await requireChannelMember(channelId, userId);

    const message = await prisma.message.findFirst({
      where: { id: messageId, channelId },
    });
    if (!message) throw new Error('Message not found');

    const isAdmin = await prisma.groupMember.findFirst({
      where: { userId, groupId, role: 'ADMIN' },
    });

    if (message.senderId !== userId && !isAdmin) {
      throw new Error('Not authorized to delete this message');
    }

    await prisma.messageStatus.deleteMany({ where: { messageId } });
    await prisma.message.delete({ where: { id: messageId } });
  },

  async saveMessage(
    channelId: string,
    senderId: string,
    content: string,
    type: MessageType = 'TEXT',
    fileUrl?: string,
  ) {
    const { groupId } = await requireChannelMember(channelId, senderId);

    // Get all group members except sender to create statuses
    const members = await prisma.groupMember.findMany({
      where: { groupId, userId: { not: senderId } },
      select: { userId: true },
    });

    const message = await prisma.message.create({
      data: {
        content,
        type,
        fileUrl: fileUrl ?? null,
        channelId,
        senderId,
        statuses: {
          create: members.map((m) => ({ userId: m.userId, status: 'SENT' })),
        },
      },
      include: MESSAGE_INCLUDE,
    });

    return message;
  },

  async updateMessageStatus(messageId: string, userId: string, status: 'DELIVERED' | 'READ') {
    const record = await prisma.messageStatus.findUnique({
      where: { messageId_userId: { messageId, userId } },
      include: { message: { select: { senderId: true } } },
    });
    if (!record) throw new Error('Message status not found');

    await prisma.messageStatus.update({
      where: { messageId_userId: { messageId, userId } },
      data: { status },
    });

    return { senderId: record.message.senderId };
  },

  async getUserChannels(userId: string): Promise<string[]> {
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: { group: { include: { channels: { select: { id: true } } } } },
    });
    return memberships.flatMap((m) => m.group.channels.map((c) => c.id));
  },

  async updatePresence(userId: string, isOnline: boolean) {
    await prisma.user.update({
      where: { id: userId },
      data: { isOnline, lastSeen: new Date() },
    });
  },
};
