import { useEffect } from 'react';
import { connectSocket, disconnectSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { Message, MessageStatus } from '../types';

export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { addMessage, updateMessageStatus, setTyping, updateUserPresence } = useChatStore();

  useEffect(() => {
    if (!accessToken) return;

    const socket = connectSocket(accessToken);

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

    return () => {
      socket.off('new-message');
      socket.off('message-status-updated');
      socket.off('user-typing');
      socket.off('user-stop-typing');
      socket.off('user-online');
      socket.off('user-offline');
      disconnectSocket();
    };
  }, [accessToken]);
}
