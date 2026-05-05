import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { Message, DirectMessage } from '../types';

// Server → client events emitted by ws-gateway. Names match exactly what the
// gateway sends; mismatched names = silently dropped.

interface ServerNewMessage {
  id: string;
  senderId: string;
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO';
  content: string;
  channelId?: string;
  conversationId?: string;
  fileUrl?: string | null;
  createdAt: string;
}

interface ServerMessageAck {
  messageId: string;
  userId: string;
  channelId?: string;
  conversationId?: string;
}

interface ServerUserPresence {
  userId: string;
  online: boolean;
  lastSeen: string | null;
  at: string;
}

export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const {
    addMessage,
    updateMessageStatus,
    setTyping,
    updateUserPresence,
    addDirectMessage,
    updateDirectMessageStatus,
  } = useChatStore();

  useEffect(() => {
    if (!accessToken) return;

    const socket = connectSocket(accessToken);

    // ── Unified message event (channel OR direct, distinguished by ids) ────
    socket.on('new-message', (m: ServerNewMessage) => {
      const myId = useAuthStore.getState().user?.id;
      if (m.conversationId) {
        // Build a DirectMessage. ws-gateway doesn't bundle sender profile,
        // so we look it up from the active conversation's participants.
        const conv = useChatStore
          .getState()
          .conversations.find((c) => c.id === m.conversationId);

        // First message in a conversation we don't know about (the other
        // user just created the DM): refetch the list so it appears in the
        // sidebar. The history fetch on opening it will pull this message in.
        if (!conv) {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }

        const senderUser = conv?.participants.find((p) => p.userId === m.senderId)?.user;
        const dm: DirectMessage = {
          id: m.id,
          content: m.content,
          type: m.type,
          fileUrl: m.fileUrl ?? null,
          createdAt: m.createdAt,
          editedAt: null,
          status: m.senderId === myId ? 'SENT' : 'DELIVERED',
          senderId: m.senderId,
          conversationId: m.conversationId,
          sender: senderUser ?? {
            id: m.senderId,
            username: 'unknown',
            displayName: 'Usuario',
            avatarUrl: null,
          },
        };
        addDirectMessage(dm);
      } else if (m.channelId) {
        const cm: Message = {
          id: m.id,
          content: m.content,
          type: m.type,
          fileUrl: m.fileUrl ?? null,
          thumbnailUrl: null,
          createdAt: m.createdAt,
          editedAt: null,
          senderId: m.senderId,
          channelId: m.channelId,
          sender: { id: m.senderId, username: 'unknown', displayName: 'Usuario', avatarUrl: null },
          statuses: [],
        };
        addMessage(cm);
      }
    });

    // ── Status acks (✓✓ gris y ✓✓ azul) ────────────────────────────────────
    socket.on('message-delivered', (a: ServerMessageAck) => {
      if (a.conversationId) {
        updateDirectMessageStatus(a.messageId, 'DELIVERED');
      } else {
        updateMessageStatus(a.messageId, a.userId, 'DELIVERED');
      }
    });

    socket.on('message-read', (a: ServerMessageAck) => {
      if (a.conversationId) {
        updateDirectMessageStatus(a.messageId, 'READ');
      } else {
        updateMessageStatus(a.messageId, a.userId, 'READ');
      }
    });

    // ── Typing indicators ─────────────────────────────────────────────────
    socket.on('user-typing', ({ userId, channelId }: { userId: string; channelId: string }) => {
      if (channelId) setTyping(userId, channelId, true);
    });

    socket.on('user-stop-typing', ({ userId, channelId }: { userId: string; channelId: string }) => {
      if (channelId) setTyping(userId, channelId, false);
    });

    // ── Presence (online/offline) ──────────────────────────────────────────
    socket.on('user-presence', (p: ServerUserPresence) => {
      updateUserPresence(p.userId, p.online);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    return () => {
      socket.off('new-message');
      socket.off('message-delivered');
      socket.off('message-read');
      socket.off('user-typing');
      socket.off('user-stop-typing');
      socket.off('user-presence');
      socket.off('connect_error');
      // Do NOT disconnect here — socket is kept alive for the session.
      // Explicit disconnect happens on logout via disconnectSocket() in Sidebar.
    };
  }, [accessToken, queryClient]);
}
