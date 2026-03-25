import { Server, Socket } from 'socket.io';
import { MessageType } from '@prisma/client';
import { directService } from './direct.service';

interface AuthSocket extends Socket {
  userId: string;
}

export class DirectGateway {
  constructor(private io: Server) {
    this.io.on('connection', (socket) => this.handleConnection(socket as AuthSocket));
  }

  private async handleConnection(socket: AuthSocket): Promise<void> {
    const { userId } = socket;
    if (!userId) return;

    // Join all existing DM conversation rooms
    try {
      const conversationIds = await directService.getUserConversationIds(userId);
      conversationIds.forEach((cid) => socket.join(`dm:${cid}`));
    } catch { /* non-critical */ }

    // ── join-conversation ──────────────────────────────────────────────────
    socket.on('join-conversation', async ({ conversationId }: { conversationId: string }) => {
      try {
        const ids = await directService.getUserConversationIds(userId);
        if (!ids.includes(conversationId)) {
          socket.emit('error', { message: 'Not a participant' });
          return;
        }
        socket.join(`dm:${conversationId}`);
        socket.emit('joined-conversation', { conversationId });
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── send-direct-message ────────────────────────────────────────────────
    socket.on(
      'send-direct-message',
      async ({
        conversationId,
        content,
        type,
        fileUrl,
      }: {
        conversationId: string;
        content: string;
        type?: string;
        fileUrl?: string;
      }) => {
        try {
          const message = await directService.saveMessage(
            conversationId,
            userId,
            content,
            (type as MessageType) ?? 'TEXT',
            fileUrl,
          );
          this.io.to(`dm:${conversationId}`).emit('new-direct-message', message);
        } catch (err: any) {
          socket.emit('error', { message: err.message });
        }
      },
    );

    // ── direct-message-read ────────────────────────────────────────────────
    socket.on('direct-message-read', async ({ messageId }: { messageId: string }) => {
      try {
        const { senderId } = await directService.updateMessageStatus(messageId, userId, 'READ');
        this.io.to(`user:${senderId}`).emit('direct-message-status-updated', {
          messageId,
          status: 'READ',
          userId,
        });
      } catch { /* ignore if message is own or already updated */ }
    });
  }
}
