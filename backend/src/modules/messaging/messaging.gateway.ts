import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { messagingService } from './messaging.service';
import { JwtPayload } from '../auth/auth.types';
import { MessageType } from './messaging.types';

interface AuthSocket extends Socket {
  userId: string;
  username: string;
  displayName: string;
}

export class MessagingGateway {
  constructor(private io: Server) {
    this.io.use(this.authenticate.bind(this));
    this.io.on('connection', (socket) => this.handleConnection(socket as AuthSocket));
  }

  private authenticate(socket: Socket, next: (err?: Error) => void): void {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token provided'));

    try {
      const payload = jwt.verify(token, config.jwtSecret) as JwtPayload & {
        username?: string;
        displayName?: string;
      };
      (socket as AuthSocket).userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  }

  private async handleConnection(socket: AuthSocket): Promise<void> {
    const { userId } = socket;

    // Join personal room for targeted status updates
    socket.join(`user:${userId}`);

    // Mark online and notify channels
    try {
      await messagingService.updatePresence(userId, true);
      const channelIds = await messagingService.getUserChannels(userId);
      channelIds.forEach((cid) => {
        this.io.to(`channel:${cid}`).emit('user-online', { userId });
      });
    } catch { /* non-critical */ }

    // ── join-channel ──────────────────────────────────────────────────────────
    socket.on('join-channel', async ({ channelId }: { channelId: string }) => {
      try {
        const messages = await messagingService.getRecentMessages(channelId, 20);
        socket.join(`channel:${channelId}`);
        socket.emit('joined-channel', { channelId, messages });
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── leave-channel ─────────────────────────────────────────────────────────
    socket.on('leave-channel', ({ channelId }: { channelId: string }) => {
      socket.leave(`channel:${channelId}`);
    });

    // ── send-message ──────────────────────────────────────────────────────────
    socket.on(
      'send-message',
      async ({
        channelId,
        content,
        type,
        fileUrl,
        thumbnailUrl,
      }: {
        channelId: string;
        content: string;
        type?: MessageType;
        fileUrl?: string;
        thumbnailUrl?: string;
      }) => {
        try {
          const message = await messagingService.saveMessage(
            channelId,
            userId,
            content,
            type ?? 'TEXT',
            fileUrl,
          );
          this.io.to(`channel:${channelId}`).emit('new-message', {
            ...message,
            thumbnailUrl: thumbnailUrl ?? null,
          });
        } catch (err: any) {
          socket.emit('error', { message: err.message });
        }
      },
    );

    // ── message-delivered ─────────────────────────────────────────────────────
    socket.on('message-delivered', async ({ messageId }: { messageId: string }) => {
      try {
        const { senderId } = await messagingService.updateMessageStatus(messageId, userId, 'DELIVERED');
        this.io.to(`user:${senderId}`).emit('message-status-updated', {
          messageId,
          status: 'DELIVERED',
          userId,
        });
      } catch { /* ignore if already updated */ }
    });

    // ── message-read ──────────────────────────────────────────────────────────
    socket.on('message-read', async ({ messageId }: { messageId: string }) => {
      try {
        const { senderId } = await messagingService.updateMessageStatus(messageId, userId, 'READ');
        this.io.to(`user:${senderId}`).emit('message-status-updated', {
          messageId,
          status: 'READ',
          userId,
        });
      } catch { /* ignore if already updated */ }
    });

    // ── typing indicators ─────────────────────────────────────────────────────
    socket.on('user-typing', ({ channelId }: { channelId: string }) => {
      socket.to(`channel:${channelId}`).emit('user-typing', { userId });
    });

    socket.on('user-stop-typing', ({ channelId }: { channelId: string }) => {
      socket.to(`channel:${channelId}`).emit('user-stop-typing', { userId });
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      try {
        await messagingService.updatePresence(userId, false);
        const channelIds = await messagingService.getUserChannels(userId);
        channelIds.forEach((cid) => {
          this.io.to(`channel:${cid}`).emit('user-offline', { userId });
        });
      } catch { /* non-critical */ }
    });
  }
}
