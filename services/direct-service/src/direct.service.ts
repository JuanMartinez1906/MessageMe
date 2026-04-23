import { AppError } from '@messageme/shared';
import { prisma } from './prisma';

export interface ConversationDto {
  conversationId: string;
  participantIds: string[];
  createdAt: Date;
  lastMessageAt: Date;
}

export const directService = {
  async getOrCreateConversation(userA: string, userB: string): Promise<ConversationDto> {
    if (!userA || !userB) throw new AppError('BAD_REQUEST', 'Both userA and userB are required');
    if (userA === userB) throw new AppError('BAD_REQUEST', 'Cannot create DM with self');

    // Find existing 1-on-1 between the two users.
    const candidates = await prisma.conversation.findMany({
      where: {
        AND: [
          { participants: { some: { userId: userA } } },
          { participants: { some: { userId: userB } } },
        ],
      },
      include: { participants: true },
    });
    const existing = candidates.find((c) => c.participants.length === 2);
    if (existing) {
      return {
        conversationId: existing.conversationId,
        participantIds: existing.participants.map((p) => p.userId),
        createdAt: existing.createdAt,
        lastMessageAt: existing.lastMessageAt,
      };
    }

    const created = await prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: userA }, { userId: userB }],
        },
      },
      include: { participants: true },
    });
    return {
      conversationId: created.conversationId,
      participantIds: created.participants.map((p) => p.userId),
      createdAt: created.createdAt,
      lastMessageAt: created.lastMessageAt,
    };
  },

  async getConversation(conversationId: string, requestedBy: string): Promise<ConversationDto> {
    const row = await prisma.conversation.findUnique({
      where: { conversationId },
      include: { participants: true },
    });
    if (!row) throw new AppError('NOT_FOUND', 'Conversation not found');
    if (!row.participants.some((p) => p.userId === requestedBy)) {
      throw new AppError('FORBIDDEN', 'Not a participant of this conversation');
    }
    return {
      conversationId: row.conversationId,
      participantIds: row.participants.map((p) => p.userId),
      createdAt: row.createdAt,
      lastMessageAt: row.lastMessageAt,
    };
  },

  async listForUser(userId: string): Promise<ConversationDto[]> {
    const rows = await prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: { participants: true },
      orderBy: { lastMessageAt: 'desc' },
    });
    return rows.map((r) => ({
      conversationId: r.conversationId,
      participantIds: r.participants.map((p) => p.userId),
      createdAt: r.createdAt,
      lastMessageAt: r.lastMessageAt,
    }));
  },

  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const p = await prisma.participant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    return !!p;
  },
};
