import { useEffect } from 'react';
import { connectSocket, disconnectSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { Message, MessageStatus, DirectMessage, DirectMessageStatus } from '../types';

export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
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

    // ── Group channel events ───────────────────────────────────────────────
    socket.on('new-message', (message: Message) => {
      addMessage(message);
    });

    socket.on(
      'message-status-updated',
      ({ messageId, userId, status }: { messageId: string; userId: string; status: MessageStatus }) => {
        updateMessageStatus(messageId, userId, status);
      },
    );

    socket.on('user-typing', ({ userId, channelId }: { userId: string; channelId: string }) => {
      setTyping(userId, channelId, true);
    });

    socket.on('user-stop-typing', ({ userId, channelId }: { userId: string; channelId: string }) => {
      setTyping(userId, channelId, false);
    });

    socket.on('user-online', ({ userId }: { userId: string }) => {
      updateUserPresence(userId, true);
    });

    socket.on('user-offline', ({ userId }: { userId: string }) => {
      updateUserPresence(userId, false);
    });

    // ── Direct message events ──────────────────────────────────────────────
    socket.on('new-direct-message', (message: DirectMessage) => {
      addDirectMessage(message);
    });

    socket.on(
      'direct-message-status-updated',
      ({ messageId, status }: { messageId: string; status: DirectMessageStatus }) => {
        updateDirectMessageStatus(messageId, status);
      },
    );

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    return () => {
      socket.off('new-message');
      socket.off('message-status-updated');
      socket.off('user-typing');
      socket.off('user-stop-typing');
      socket.off('user-online');
      socket.off('user-offline');
      socket.off('new-direct-message');
      socket.off('direct-message-status-updated');
      socket.off('connect_error');
      // Do NOT disconnect here — socket is kept alive for the session.
      // Explicit disconnect happens on logout via disconnectSocket() in Sidebar.
    };
  }, [accessToken]);
}
