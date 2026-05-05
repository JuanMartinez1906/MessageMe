import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { useSocket } from '../hooks/useSocket';
import Sidebar from '../components/layout/Sidebar';
import ChatWindow from '../components/layout/ChatWindow';
import DmChatWindow from '../components/direct/DmChatWindow';
import { Group, DirectConversation } from '../types';

interface PresenceEntry {
  userId: string;
  online: boolean;
  lastSeen?: string | null;
}

export default function ChatPage() {
  const setGroups = useChatStore((s) => s.setGroups);
  const setConversations = useChatStore((s) => s.setConversations);
  const updateUserPresence = useChatStore((s) => s.updateUserPresence);
  const conversationsInStore = useChatStore((s) => s.conversations);
  const groupsInStore = useChatStore((s) => s.groups);
  const activeConversation = useChatStore((s) => s.activeConversation);
  const myId = useAuthStore((s) => s.user?.id);

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

  // Stable key derived from the set of "interesting" user ids (other DM
  // participants + group members). The REST endpoints return isOnline=false
  // unconditionally; this lets us seed the real state via `get-presence` and
  // re-seed whenever the set changes (new contact, new group member) or the
  // socket reconnects after a drop. Using a sorted key avoids re-querying when
  // unrelated store fields change.
  const userIdsKey = useMemo(() => {
    const ids = new Set<string>();
    conversationsInStore.forEach((c) =>
      c.participants.forEach((p) => {
        if (p.userId !== myId) ids.add(p.userId);
      })
    );
    groupsInStore.forEach((g) =>
      g.members.forEach((m) => {
        if (m.user.id !== myId) ids.add(m.user.id);
      })
    );
    return [...ids].sort().join(',');
  }, [conversationsInStore, groupsInStore, myId]);

  useEffect(() => {
    if (!userIdsKey) return;
    const userIds = userIdsKey.split(',');
    const socket = getSocket();
    if (!socket) return;

    const query = () => {
      socket.emit('get-presence', { userIds }, (entries: PresenceEntry[] | undefined) => {
        (entries ?? []).forEach((e) => updateUserPresence(e.userId, e.online));
      });
    };

    if (socket.connected) query();
    socket.on('connect', query);
    return () => {
      socket.off('connect', query);
    };
  }, [userIdsKey, updateUserPresence]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      {activeConversation ? <DmChatWindow /> : <ChatWindow />}
    </div>
  );
}
