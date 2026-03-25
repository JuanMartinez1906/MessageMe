import { useChatStore } from '../../store/chatStore';

interface Props {
  channelId: string;
  memberMap: Record<string, string>; // userId -> displayName
  currentUserId: string;
}

export default function TypingIndicator({ channelId, memberMap, currentUserId }: Props) {
  const typingUsers = useChatStore((s) =>
    s.typingUsers.filter((t) => t.channelId === channelId && t.userId !== currentUserId),
  );

  if (typingUsers.length === 0) return null;

  const names = typingUsers
    .map((t) => memberMap[t.userId] ?? 'Alguien')
    .slice(0, 2)
    .join(', ');

  const label = typingUsers.length === 1 ? `${names} está escribiendo` : `${names} están escribiendo`;

  return (
    <div className="flex items-center gap-2 px-4 pb-1">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 bg-[#8696a0] rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="text-[#8696a0] text-xs italic">{label}...</span>
    </div>
  );
}
