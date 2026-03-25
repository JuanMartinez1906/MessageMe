import { MessageType, MessageStatusEnum } from '@prisma/client';

export { MessageType, MessageStatusEnum };

export interface SendMessagePayload {
  channelId: string;
  content: string;
  type?: MessageType;
}

export interface MessageStatusPayload {
  messageId: string;
}

export interface TypingPayload {
  channelId: string;
}

export interface AuthSocket {
  userId: string;
  username: string;
  displayName: string;
}
