import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useChatStore } from '../store/chatStore';
import { useSocket } from '../hooks/useSocket';
import Sidebar from '../components/layout/Sidebar';
import ChatWindow from '../components/layout/ChatWindow';
import DmChatWindow from '../components/direct/DmChatWindow';
import { Group, DirectConversation } from '../types';

export default function ChatPage() {
  const { setGroups, setConversations, activeConversation } = useChatStore();
  useSocket();

  const { data: groups } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await api.get('/groups');
      return data;
    },
  });

  const { data: conversations } = useQuery<DirectConversation[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data } = await api.get('/direct/conversations');
      return data;
    },
  });

  useEffect(() => {
    if (groups) setGroups(groups);
  }, [groups]);

  useEffect(() => {
    if (conversations) setConversations(conversations);
  }, [conversations]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      {activeConversation ? <DmChatWindow /> : <ChatWindow />}
    </div>
  );
}
