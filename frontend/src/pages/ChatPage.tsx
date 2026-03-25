import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useChatStore } from '../store/chatStore';
import { useSocket } from '../hooks/useSocket';
import Sidebar from '../components/layout/Sidebar';
import ChatWindow from '../components/layout/ChatWindow';
import { Group } from '../types';

export default function ChatPage() {
  const setGroups = useChatStore((s) => s.setGroups);
  useSocket();

  const { data: groups } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await api.get('/groups');
      return data;
    },
  });

  useEffect(() => {
    if (groups) setGroups(groups);
  }, [groups]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <ChatWindow />
    </div>
  );
}
