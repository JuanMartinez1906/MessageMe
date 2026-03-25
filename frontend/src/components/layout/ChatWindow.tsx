import { useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useMessages } from '../../hooks/useMessages';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';
import TypingIndicator from '../chat/TypingIndicator';
import Avatar from '../ui/Avatar';
import MembersPanel from '../groups/MembersPanel';

export default function ChatWindow() {
  const { activeChannel, activeGroup, messages } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const { markRead } = useMessages(activeChannel?.id ?? null);
  const [showMembers, setShowMembers] = useState(false);

  if (!activeChannel || !activeGroup) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0b141a]">
        <div className="text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-[#374045]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 className="text-[#e9edef] text-xl font-light mb-2">MessageMe</h2>
          <p className="text-[#8696a0] text-sm">
            Selecciona un grupo y canal para comenzar a chatear
          </p>
        </div>
      </div>
    );
  }

  const memberMap = Object.fromEntries(
    activeGroup.members.map((m) => [m.user.id, m.user.displayName]),
  );
  const onlineMembers = activeGroup.members.filter((m) => m.user.isOnline);
  const isAdmin = activeGroup.members.find((m) => m.user.id === user?.id)?.role === 'ADMIN';

  return (
    <div className="flex-1 flex min-w-0 bg-[#0b141a] overflow-hidden">
      {/* Main chat column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[#202c33] border-b border-[#374045]">
          <Avatar name={activeGroup.name} url={activeGroup.avatarUrl} />
          <div className="flex-1 min-w-0">
            <p className="text-[#e9edef] text-sm font-medium">
              {activeGroup.name} &nbsp;<span className="text-[#8696a0] font-normal"># {activeChannel.name}</span>
            </p>
            <div className="flex items-center gap-1 flex-wrap">
              {onlineMembers.slice(0, 4).map((m) => (
                <span key={m.user.id} className="text-[#8696a0] text-xs">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-1" />
                  {m.user.displayName}
                </span>
              ))}
              {onlineMembers.length > 4 && (
                <span className="text-[#8696a0] text-xs">+{onlineMembers.length - 4} más</span>
              )}
              {onlineMembers.length === 0 && (
                <span className="text-[#8696a0] text-xs">Nadie en línea</span>
              )}
            </div>
          </div>

          {/* Member count button */}
          <button
            onClick={() => setShowMembers((v) => !v)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
              showMembers
                ? 'bg-[#2a3942] text-teal-400'
                : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]'
            }`}
            title="Ver miembros"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {activeGroup.members.length} miembros
          </button>
        </div>

        {/* Messages */}
        <MessageList
          messages={messages}
          currentUserId={user!.id}
          onBottomVisible={markRead}
        />

        {/* Typing indicator */}
        <TypingIndicator
          channelId={activeChannel.id}
          memberMap={memberMap}
          currentUserId={user!.id}
        />

        {/* Input */}
        <MessageInput channelId={activeChannel.id} />
      </div>

      {/* Members panel */}
      {showMembers && (
        <MembersPanel
          group={activeGroup}
          currentUserId={user!.id}
          isAdmin={isAdmin ?? false}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>
  );
}
