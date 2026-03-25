import { useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { DirectConversation } from '../../types';
import Avatar from '../ui/Avatar';
import NewDmModal from './NewDmModal';

function getOtherParticipant(conversation: DirectConversation, myId: string) {
  return conversation.participants.find((p) => p.userId !== myId)?.user;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

export default function ConversationList() {
  const { conversations, activeConversation, setActiveConversation } = useChatStore();
  const myId = useAuthStore((s) => s.user?.id);
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#374045]">
        <span className="text-[#8696a0] text-xs font-semibold uppercase tracking-wider">Mensajes directos</span>
        <button
          onClick={() => setShowNew(true)}
          className="text-[#8696a0] hover:text-teal-400 transition-colors"
          title="Nuevo mensaje"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="text-[#8696a0] text-sm text-center py-8 px-4">
            Sin conversaciones.{' '}
            <button onClick={() => setShowNew(true)} className="text-teal-400 hover:underline">
              Inicia una
            </button>
          </p>
        ) : (
          conversations.map((conv) => {
            const other = getOtherParticipant(conv, myId ?? '');
            const lastMsg = conv.messages[0];
            const isActive = activeConversation?.id === conv.id;

            return (
              <button
                key={conv.id}
                onClick={() => setActiveConversation(isActive ? null : conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                  isActive ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar
                    name={other?.displayName ?? '?'}
                    url={other?.avatarUrl ?? null}
                    isOnline={other?.isOnline}
                    size="md"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[#e9edef] text-sm font-medium truncate">
                      {other?.displayName ?? 'Usuario'}
                    </span>
                    {lastMsg && (
                      <span className="text-[#8696a0] text-[11px] ml-2 flex-shrink-0">
                        {formatTime(lastMsg.createdAt)}
                      </span>
                    )}
                  </div>
                  {lastMsg && (
                    <p className="text-[#8696a0] text-xs truncate mt-0.5">
                      {lastMsg.senderId === myId ? 'Tú: ' : ''}
                      {lastMsg.type === 'TEXT' ? lastMsg.content : `[${lastMsg.type.toLowerCase()}]`}
                    </p>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {showNew && <NewDmModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
