import { create } from 'zustand';
import { Group, Channel, Message, MessageStatus, DirectConversation, DirectMessage, DirectMessageStatus } from '../types';

interface TypingUser {
  userId: string;
  channelId: string;
}

interface ChatState {
  // Groups / channels
  groups: Group[];
  activeGroup: Group | null;
  activeChannel: Channel | null;
  messages: Message[];
  typingUsers: TypingUser[];

  // Direct messages
  conversations: DirectConversation[];
  activeConversation: DirectConversation | null;
  directMessages: DirectMessage[];

  // Groups actions
  setGroups: (groups: Group[]) => void;
  addGroup: (group: Group) => void;
  updateGroup: (group: Group) => void;
  setActiveGroup: (group: Group | null) => void;
  setActiveChannel: (channel: Channel | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessageStatus: (messageId: string, userId: string, status: MessageStatus) => void;
  setTyping: (userId: string, channelId: string, isTyping: boolean) => void;
  updateUserPresence: (userId: string, isOnline: boolean) => void;

  // DM actions
  setConversations: (conversations: DirectConversation[]) => void;
  addConversation: (conversation: DirectConversation) => void;
  setActiveConversation: (conversation: DirectConversation | null) => void;
  setDirectMessages: (messages: DirectMessage[]) => void;
  addDirectMessage: (message: DirectMessage) => void;
  updateDirectMessageStatus: (messageId: string, status: DirectMessageStatus) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  groups: [],
  activeGroup: null,
  activeChannel: null,
  messages: [],
  typingUsers: [],
  conversations: [],
  activeConversation: null,
  directMessages: [],

  setGroups: (groups) => set((s) => ({
    groups,
    activeGroup: s.activeGroup ? (groups.find((g) => g.id === s.activeGroup!.id) ?? s.activeGroup) : null,
  })),
  addGroup: (group) => set((s) => ({ groups: [group, ...s.groups] })),
  updateGroup: (group) => set((s) => ({
    groups: s.groups.map((g) => (g.id === group.id ? group : g)),
    activeGroup: s.activeGroup?.id === group.id ? group : s.activeGroup,
  })),

  setActiveGroup: (group) =>
    set({ activeGroup: group, activeChannel: null, messages: [], activeConversation: null, directMessages: [] }),
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
      conversations: s.conversations.map((c) => ({
        ...c,
        participants: c.participants.map((p) =>
          p.user.id === userId ? { ...p, user: { ...p.user, isOnline } } : p,
        ),
      })),
    })),

  setConversations: (conversations) => set({ conversations }),
  addConversation: (conversation) =>
    set((s) => {
      if (s.conversations.some((c) => c.id === conversation.id)) return s;
      return { conversations: [conversation, ...s.conversations] };
    }),

  setActiveConversation: (conversation) =>
    set({ activeConversation: conversation, directMessages: [], activeGroup: null, activeChannel: null, messages: [] }),

  setDirectMessages: (directMessages) => set({ directMessages }),
  addDirectMessage: (message) =>
    set((s) => {
      if (s.directMessages.some((m) => m.id === message.id)) return s;
      return { directMessages: [...s.directMessages, message] };
    }),

  updateDirectMessageStatus: (messageId, status) =>
    set((s) => ({
      directMessages: s.directMessages.map((m) =>
        m.id === messageId ? { ...m, status } : m,
      ),
    })),
}));
