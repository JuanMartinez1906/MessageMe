import { Server, Socket } from 'socket.io';
import { createLogger } from '@messageme/shared';
import { auth, group, direct, message, presence, delivery } from './grpc-clients';
import {
  MessageSentEvent,
  MessageDeliveredEvent,
  MessageReadEvent,
  UserPresenceEvent,
  MediaReadyEvent,
} from './kafka-consumer';

const log = createLogger('ws-gateway:gateway');

interface AuthSocket extends Socket {
  userId: string;
}

// Heartbeat cadence — refresh the presence TTL in Redis well before it expires (90s default).
const HEARTBEAT_INTERVAL_MS = 30_000;

function normalizeMessage(payload: any) {
  return {
    id: payload.messageId ?? payload.message_id,
    senderId: payload.senderId ?? payload.sender_id,
    type: (payload.type ?? 'MESSAGE_TYPE_TEXT').replace(/^MESSAGE_TYPE_/, ''),
    content: payload.content ?? '',
    fileUrl: payload.fileUrl ?? payload.file_url ?? null,
    channelId: payload.channelId ?? payload.channel_id ?? null,
    conversationId: payload.conversationId ?? payload.conversation_id ?? null,
    createdAt:
      typeof payload.createdAt === 'object' && payload.createdAt?.seconds
        ? new Date(Number(payload.createdAt.seconds) * 1000).toISOString()
        : payload.created_at ?? new Date().toISOString(),
  };
}

export class Gateway {
  constructor(private io: Server) {
    this.io.use(this.authenticate.bind(this));
    this.io.on('connection', (socket) => this.handleConnection(socket as AuthSocket));
  }

  private async authenticate(socket: Socket, next: (err?: Error) => void): Promise<void> {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token provided'));
    try {
      const res = await auth.validateToken({ accessToken: token });
      if (!res.valid) return next(new Error('Invalid token'));
      (socket as AuthSocket).userId = res.userId;
      next();
    } catch (err) {
      log.warn({ err }, 'ws auth failed');
      next(new Error('Invalid or expired token'));
    }
  }

  private async handleConnection(socket: AuthSocket): Promise<void> {
    const { userId } = socket;
    const sessionId = socket.id;
    socket.join(`user:${userId}`);

    // Mark the user online — presence-service publishes `user.presence` on the
    // offline → online transition and the Kafka consumer fans it out.
    presence
      .setOnline({ userId, sessionId })
      .catch((err) => log.warn({ err, userId }, 'setOnline failed'));

    // Periodic heartbeat so the Redis session key does not expire while the socket is open.
    const heartbeatTimer = setInterval(() => {
      presence
        .heartbeat({ userId, sessionId })
        .catch((err) => log.warn({ err, userId }, 'heartbeat failed'));
    }, HEARTBEAT_INTERVAL_MS);

    socket.on('disconnect', () => {
      clearInterval(heartbeatTimer);
      presence
        .setOffline({ userId, sessionId })
        .catch((err) => log.warn({ err, userId }, 'setOffline failed'));
    });

    // Auto-join rooms for the user's channels and conversations so Kafka fan-out
    // from any node reaches their clients.
    try {
      const groups = await group.listGroupsForUser({ userId });
      for (const g of groups.groups) socket.join(`group:${g.groupId}`);
      const convs = await direct.listForUser({ userId });
      for (const c of convs.conversations) socket.join(`conv:${c.conversationId}`);
    } catch (err) {
      log.warn({ err, userId }, 'failed to auto-join rooms');
    }

    socket.on('join-channel', async ({ channelId }: { channelId: string }) => {
      try {
        socket.join(`channel:${channelId}`);
        const res = await message.getHistory({
          channelId,
          page: { cursor: '', limit: '20' },
        });
        socket.emit('joined-channel', {
          channelId,
          messages: res.messages.map(normalizeMessage),
        });
      } catch (err: any) {
        socket.emit('error', { message: err.message ?? 'join-channel failed' });
      }
    });

    socket.on('leave-channel', ({ channelId }: { channelId: string }) => {
      socket.leave(`channel:${channelId}`);
    });

    socket.on('join-conversation', async ({ conversationId }: { conversationId: string }) => {
      try {
        socket.join(`conv:${conversationId}`);
        const res = await message.getHistory({
          conversationId,
          page: { cursor: '', limit: '20' },
        });
        socket.emit('joined-conversation', {
          conversationId,
          messages: res.messages.map(normalizeMessage),
        });
      } catch (err: any) {
        socket.emit('error', { message: err.message ?? 'join-conversation failed' });
      }
    });

    socket.on('send-message', async (payload: any) => {
      try {
        const type = payload.type
          ? `MESSAGE_TYPE_${String(payload.type).toUpperCase()}`
          : 'MESSAGE_TYPE_TEXT';
        await message.sendMessage({
          senderId: userId,
          type,
          content: payload.content ?? '',
          fileUrl: payload.fileUrl || undefined,
          channelId: payload.channelId || undefined,
          conversationId: payload.conversationId || undefined,
          clientMessageId: payload.clientMessageId || undefined,
        });
        // Broadcasting happens in response to the Kafka event so every ws-gateway
        // replica sees it (single source of truth).
      } catch (err: any) {
        socket.emit('error', { message: err.message ?? 'send-message failed' });
      }
    });

    // Client-driven delivery acks. Typically a client auto-acks on receiving
    // `new-message` (delivered) and again when the message is visible (read).
    socket.on('message-delivered', async ({ messageId }: { messageId: string }) => {
      try {
        await delivery.markDelivered({ messageId, userId });
      } catch (err: any) {
        log.warn({ err, userId, messageId }, 'markDelivered failed');
      }
    });

    socket.on('message-read', async ({ messageId }: { messageId: string }) => {
      try {
        await delivery.markRead({ messageId, userId });
      } catch (err: any) {
        log.warn({ err, userId, messageId }, 'markRead failed');
      }
    });

    socket.on(
      'get-presence',
      async (
        payload: { userIds: string[] },
        cb?: (entries: Array<{ userId: string; online: boolean; lastSeen?: string | null }>) => void
      ) => {
        try {
          const res = await presence.getPresence({ userIds: payload.userIds ?? [] });
          const entries = res.entries.map((e) => ({
            userId: e.userId,
            online: e.online,
            lastSeen:
              e.lastSeen && typeof e.lastSeen === 'object' && e.lastSeen.seconds
                ? new Date(Number(e.lastSeen.seconds) * 1000).toISOString()
                : null,
          }));
          cb?.(entries);
        } catch (err: any) {
          log.warn({ err, userId }, 'getPresence failed');
          cb?.([]);
        }
      }
    );

    socket.on('user-typing', (payload: { channelId?: string; conversationId?: string }) => {
      if (payload.channelId) {
        socket.to(`channel:${payload.channelId}`).emit('user-typing', { userId });
      } else if (payload.conversationId) {
        socket.to(`conv:${payload.conversationId}`).emit('user-typing', { userId });
      }
    });

    socket.on('user-stop-typing', (payload: { channelId?: string; conversationId?: string }) => {
      if (payload.channelId) {
        socket.to(`channel:${payload.channelId}`).emit('user-stop-typing', { userId });
      } else if (payload.conversationId) {
        socket.to(`conv:${payload.conversationId}`).emit('user-stop-typing', { userId });
      }
    });
  }

  // Called by the Kafka consumer for every `messages.sent` event.
  handleMessageSent(event: MessageSentEvent): void {
    const p = event.payload;
    const envelope = {
      id: p.message_id,
      senderId: p.sender_id,
      type: p.type.replace(/^MESSAGE_TYPE_/, ''),
      content: p.content ?? '',
      channelId: p.channel_id,
      conversationId: p.conversation_id,
      createdAt: p.created_at,
    };
    // Fan-out by explicit recipient list + sender echo so every participant
    // receives the event regardless of which rooms they're currently in.
    const targets = new Set<string>([p.sender_id, ...(p.recipient_ids ?? [])]);
    for (const uid of targets) {
      this.io.to(`user:${uid}`).emit('new-message', envelope);
    }
  }

  // Delivery ack — push only to the original sender so their client can flip
  // the status indicator (single check → double check).
  handleMessageDelivered(event: MessageDeliveredEvent): void {
    const p = event.payload;
    this.io.to(`user:${p.sender_id}`).emit('message-delivered', {
      messageId: p.message_id,
      userId: p.user_id,
      channelId: p.channel_id,
      conversationId: p.conversation_id,
      deliveredAt: p.delivered_at,
    });
  }

  handleMessageRead(event: MessageReadEvent): void {
    const p = event.payload;
    this.io.to(`user:${p.sender_id}`).emit('message-read', {
      messageId: p.message_id,
      userId: p.user_id,
      channelId: p.channel_id,
      conversationId: p.conversation_id,
      readAt: p.read_at,
    });
  }

  // Presence fan-out — broadcast to every connected client so UIs can update.
  // In a production deployment we'd narrow this to the set of users who share a
  // group/conversation with the changed user, but that requires another lookup
  // per event; for MVP we rely on the compacted `user.presence` topic + a global
  // emit (every gateway replica filters nothing).
  handleUserPresence(event: UserPresenceEvent): void {
    const p = event.payload;
    this.io.emit('user-presence', {
      userId: p.user_id,
      online: p.online,
      lastSeen: p.last_seen,
      at: p.at,
    });
  }

  // Media-processor finished (or failed) deriving thumbnails. Broadcast so any
  // client viewing the message that references this file can update its preview.
  // MVP uses a global emit; production would narrow by the file's owner room.
  handleMediaReady(event: MediaReadyEvent): void {
    const p = event.payload;
    this.io.emit('file-ready', {
      fileId: p.file_id,
      status: p.status,
      thumbnailKey: p.thumbnail_key,
      width: p.width,
      height: p.height,
      error: p.error,
      processedAt: p.processed_at,
    });
  }
}
