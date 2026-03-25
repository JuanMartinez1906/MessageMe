import { useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { Message } from '../types';

export function useMessages(channelId: string | null) {
  const userId = useAuthStore((s) => s.user?.id);
  const { setMessages } = useChatStore();

  const { data } = useQuery<Message[]>({
    queryKey: ['messages', channelId],
    queryFn: async () => {
      const { data } = await api.get(`/channels/${channelId}/messages`);
      return data;
    },
    enabled: !!channelId,
  });

  useEffect(() => {
    if (!data) return;
    setMessages(data);

    // Emit delivered for unread messages
    const socket = getSocket();
    if (!socket || !userId) return;
    data.forEach((msg) => {
      if (msg.senderId === userId) return;
      const myStatus = msg.statuses.find((s) => s.userId === userId);
      if (!myStatus || myStatus.status === 'SENT') {
        socket.emit('message-delivered', { messageId: msg.id });
      }
    });
  }, [data, userId]);

  const markRead = useCallback((messageId: string) => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('message-read', { messageId });
  }, []);

  return { markRead };
}
