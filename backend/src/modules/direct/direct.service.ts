import { MessageType } from '@prisma/client';
import { prisma } from '../../config/prisma';

const SENDER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  isOnline: true,
};

export const directService = {
  async getOrCreateConversation(userId: string, participantId: string) {
    // Find existing 1-on-1 conversation between the two users
    const conversations = await prisma.directConversation.findMany({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: participantId } } },
        ],
      },
      include: {
        participants: { include: { user: { select: SENDER_SELECT } } },
        _count: { select: { participants: true } },
      },
    });

    const found = conversations.find((c) => c._count.participants === 2);
    if (found) return found;

    return prisma.directConversation.create({
      data: {
        participants: {
          create: [{ userId }, { userId: participantId }],
        },
      },
      include: {
        participants: { include: { user: { select: SENDER_SELECT } } },
      },
    });
  },

  async getConversations(userId: string) {
    return prisma.directConversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { include: { user: { select: SENDER_SELECT } } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: SENDER_SELECT } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getMessages(conversationId: string, userId: string, cursor?: string) {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
    });
    if (!participant) throw new Error('Not a participant in this conversation');

    const messages = await prisma.directMessage.findMany({
      where: { conversationId },
      include: { sender: { select: SENDER_SELECT } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    return messages.reverse();
  },

  async saveMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: MessageType = 'TEXT',
    fileUrl?: string,
  ) {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId: senderId, conversationId } },
    });
    if (!participant) throw new Error('Not a participant in this conversation');

    return prisma.directMessage.create({
      data: {
        content,
        type,
        fileUrl: fileUrl ?? null,
        conversationId,
        senderId,
        status: 'SENT',
      },
      include: { sender: { select: SENDER_SELECT } },
    });
  },

  async updateMessageStatus(messageId: string, userId: string, status: 'DELIVERED' | 'READ') {
    const message = await prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new Error('Message not found');
    if (message.senderId === userId) throw new Error('Cannot update status of own message');

    await prisma.directMessage.update({
      where: { id: messageId },
      data: { status },
    });

    return { senderId: message.senderId };
  },

  async getUserConversationIds(userId: string): Promise<string[]> {
    const participants = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    return participants.map((p) => p.conversationId);
  },

  async searchUsers(query: string, currentUserId: string) {
    return prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true, displayName: true, avatarUrl: true, isOnline: true },
      take: 10,
    });
  },
};
