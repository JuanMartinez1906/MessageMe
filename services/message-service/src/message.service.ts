import { randomUUID } from 'crypto';
import { AppError } from '@messageme/shared';
import { messages, MessageDoc } from './mongo';
import { publishMessageSent, MessageSentPayload } from './kafka';
import { channelRpc, groupRpc, directRpc } from './scope-clients';

export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO';

export interface MessageDto {
  messageId: string;
  senderId: string;
  type: MessageType;
  content: string;
  fileUrl: string | null;
  channelId: string | null;
  conversationId: string | null;
  createdAt: Date;
  editedAt: Date | null;
}

function typeFromProto(t: string | undefined): MessageType {
  switch (t) {
    case 'MESSAGE_TYPE_IMAGE':
      return 'IMAGE';
    case 'MESSAGE_TYPE_FILE':
      return 'FILE';
    case 'MESSAGE_TYPE_AUDIO':
      return 'AUDIO';
    case 'MESSAGE_TYPE_TEXT':
    default:
      return 'TEXT';
  }
}

export function typeToProto(t: MessageType): string {
  return `MESSAGE_TYPE_${t}`;
}

function toDto(doc: MessageDoc): MessageDto {
  return {
    messageId: doc._id,
    senderId: doc.senderId,
    type: doc.type,
    content: doc.content,
    fileUrl: doc.fileUrl ?? null,
    channelId: doc.channelId ?? null,
    conversationId: doc.conversationId ?? null,
    createdAt: doc.createdAt,
    editedAt: doc.editedAt ?? null,
  };
}

async function resolveChannelRecipients(
  channelId: string,
  senderId: string
): Promise<{ recipients: string[]; groupId: string }> {
  const ch = await channelRpc.getChannel({ channelId });
  const members = await groupRpc.listMembers({ groupId: ch.groupId });
  if (!members.members.some((m) => m.userId === senderId)) {
    throw new AppError('FORBIDDEN', 'Not a member of this channel');
  }
  return {
    recipients: members.members.map((m) => m.userId).filter((u) => u !== senderId),
    groupId: ch.groupId,
  };
}

async function resolveConversationRecipients(
  conversationId: string,
  senderId: string
): Promise<string[]> {
  const conv = await directRpc.getConversation({ conversationId, requestedBy: senderId });
  return conv.participantIds.filter((u) => u !== senderId);
}

export const messageService = {
  async sendMessage(args: {
    senderId: string;
    type: MessageType;
    content: string;
    fileUrl?: string;
    channelId?: string;
    conversationId?: string;
    clientMessageId?: string;
  }): Promise<MessageDto> {
    if (!args.senderId) throw new AppError('BAD_REQUEST', 'senderId is required');
    const hasChannel = !!args.channelId;
    const hasConv = !!args.conversationId;
    if (hasChannel === hasConv) {
      throw new AppError('BAD_REQUEST', 'Exactly one of channelId or conversationId must be set');
    }

    // Idempotency: if a prior send with same (senderId, clientMessageId) exists, return it.
    if (args.clientMessageId) {
      const prior = await messages().findOne({
        senderId: args.senderId,
        clientMessageId: args.clientMessageId,
      });
      if (prior) return toDto(prior);
    }

    let recipients: string[] = [];
    if (hasChannel) {
      const r = await resolveChannelRecipients(args.channelId!, args.senderId);
      recipients = r.recipients;
    } else {
      recipients = await resolveConversationRecipients(args.conversationId!, args.senderId);
    }

    const doc: MessageDoc = {
      _id: randomUUID(),
      senderId: args.senderId,
      type: args.type,
      content: args.content ?? '',
      fileUrl: args.fileUrl ?? null,
      channelId: args.channelId ?? null,
      conversationId: args.conversationId ?? null,
      createdAt: new Date(),
      editedAt: null,
      clientMessageId: args.clientMessageId ?? null,
    };
    await messages().insertOne(doc);

    const payload: MessageSentPayload = {
      message_id: doc._id,
      sender_id: doc.senderId,
      type: doc.type,
      content: doc.content,
      file_id: null,
      channel_id: doc.channelId ?? null,
      conversation_id: doc.conversationId ?? null,
      recipient_ids: recipients,
      created_at: doc.createdAt.toISOString(),
    };
    const partitionKey = (doc.channelId ?? doc.conversationId)!;
    await publishMessageSent(payload, partitionKey);

    return toDto(doc);
  },

  async getMessage(messageId: string): Promise<MessageDto> {
    const doc = await messages().findOne({ _id: messageId });
    if (!doc) throw new AppError('NOT_FOUND', 'Message not found');
    return toDto(doc);
  },

  async getHistory(args: {
    channelId?: string;
    conversationId?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ messages: MessageDto[]; nextCursor: string; hasMore: boolean }> {
    const hasChannel = !!args.channelId;
    const hasConv = !!args.conversationId;
    if (hasChannel === hasConv) {
      throw new AppError('BAD_REQUEST', 'Exactly one of channelId or conversationId is required');
    }
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const filter: Record<string, unknown> = hasChannel
      ? { channelId: args.channelId }
      : { conversationId: args.conversationId };

    if (args.cursor) {
      const cursorDate = new Date(args.cursor);
      if (!isNaN(cursorDate.getTime())) filter.createdAt = { $lt: cursorDate };
    }

    const docs = await messages().find(filter).sort({ createdAt: -1 }).limit(limit + 1).toArray();
    const hasMore = docs.length > limit;
    const page = docs.slice(0, limit);
    const nextCursor =
      hasMore && page.length > 0 ? page[page.length - 1].createdAt.toISOString() : '';
    return { messages: page.reverse().map(toDto), nextCursor, hasMore };
  },

  async editMessage(args: { messageId: string; senderId: string; newContent: string }): Promise<MessageDto> {
    const doc = await messages().findOne({ _id: args.messageId });
    if (!doc) throw new AppError('NOT_FOUND', 'Message not found');
    if (doc.senderId !== args.senderId) {
      throw new AppError('FORBIDDEN', 'Only the sender can edit this message');
    }
    const editedAt = new Date();
    await messages().updateOne(
      { _id: args.messageId },
      { $set: { content: args.newContent, editedAt } }
    );
    return toDto({ ...doc, content: args.newContent, editedAt });
  },

  async deleteMessage(args: { messageId: string; senderId: string }): Promise<void> {
    const doc = await messages().findOne({ _id: args.messageId });
    if (!doc) throw new AppError('NOT_FOUND', 'Message not found');
    if (doc.senderId !== args.senderId) {
      throw new AppError('FORBIDDEN', 'Only the sender can delete this message');
    }
    await messages().deleteOne({ _id: args.messageId });
  },

  _typeFromProto: typeFromProto,
};
