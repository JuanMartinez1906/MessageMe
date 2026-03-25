import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useMessages } from '../../hooks/useMessages';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';
import TypingIndicator from '../chat/TypingIndicator';
import Avatar from '../ui/Avatar';

export default function ChatWindow() {
  const { activeChannel, activeGroup, messages } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const { markRead } = useMessages(activeChannel?.id ?? null);

  if (!activeChannel || !activeGroup) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0b141a]">
        <div className="text-center">
          <div className="text-6xl mb-4">💬</div>
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

  return (
    <div className="flex-1 flex flex-col bg-[#0b141a] min-w-0">
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
  );
}
