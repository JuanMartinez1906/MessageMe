import { create } from 'zustand';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  sender: { id: string; username: string };
  receiverId?: string;
  groupId?: string;
}

interface ChatState {
  messages: Message[];
  activeConversation: { type: 'direct' | 'group'; id: string } | null;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setActiveConversation: (conv: { type: 'direct' | 'group'; id: string } | null) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  activeConversation: null,
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setMessages: (messages) => set({ messages }),
  setActiveConversation: (conv) => set({ activeConversation: conv, messages: [] }),
  clearMessages: () => set({ messages: [] }),
}));
