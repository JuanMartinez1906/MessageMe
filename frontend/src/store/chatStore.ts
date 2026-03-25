import { create } from 'zustand';
import { Group, Channel, Message, MessageStatus } from '../types';

interface TypingUser {
  userId: string;
  channelId: string;
}

interface ChatState {
  groups: Group[];
  activeGroup: Group | null;
  activeChannel: Channel | null;
  messages: Message[];
  typingUsers: TypingUser[];

  setGroups: (groups: Group[]) => void;
  addGroup: (group: Group) => void;
  setActiveGroup: (group: Group | null) => void;
  setActiveChannel: (channel: Channel | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessageStatus: (messageId: string, userId: string, status: MessageStatus) => void;
  setTyping: (userId: string, channelId: string, isTyping: boolean) => void;
  updateUserPresence: (userId: string, isOnline: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  groups: [],
  activeGroup: null,
  activeChannel: null,
  messages: [],
  typingUsers: [],

  setGroups: (groups) => set({ groups }),
  addGroup: (group) => set((s) => ({ groups: [group, ...s.groups] })),

  setActiveGroup: (group) => set({ activeGroup: group, activeChannel: null, messages: [] }),
  setActiveChannel: (channel) => set({ activeChannel: channel, messages: [] }),

  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((s) => {
      if (s.messages.some((m) => m.id === message.id)) return s;
      return { messages: [...s.messages, message] };
    }),

  updateMessageStatus: (messageId, userId, status) =>
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== messageId) return m;
        const existing = m.statuses.find((st) => st.userId === userId);
        const statuses = existing
          ? m.statuses.map((st) =>
              st.userId === userId ? { ...st, status, updatedAt: new Date().toISOString() } : st,
            )
          : [...m.statuses, { userId, status, updatedAt: new Date().toISOString() }];
        return { ...m, statuses };
      }),
    })),

  setTyping: (userId, channelId, isTyping) =>
    set((s) => ({
      typingUsers: isTyping
        ? s.typingUsers.some((t) => t.userId === userId && t.channelId === channelId)
          ? s.typingUsers
          : [...s.typingUsers, { userId, channelId }]
        : s.typingUsers.filter((t) => !(t.userId === userId && t.channelId === channelId)),
    })),

  updateUserPresence: (userId, isOnline) =>
    set((s) => ({
      groups: s.groups.map((g) => ({
        ...g,
        members: g.members.map((m) =>
          m.user.id === userId ? { ...m, user: { ...m.user, isOnline } } : m,
        ),
      })),
    })),
}));
