import { useEffect, useRef } from 'react';
import { Message } from '../../types';
import MessageBubble from './MessageBubble';

interface Props {
  messages: Message[];
  currentUserId: string;
  onBottomVisible: (messageId: string) => void;
}

export default function MessageList({ messages, currentUserId, onBottomVisible }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMsgId = messages[messages.length - 1]?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (lastMsgId) onBottomVisible(lastMsgId);
  }, [lastMsgId]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[#8696a0] text-sm">No hay mensajes aún. ¡Sé el primero!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isOwn={msg.senderId === currentUserId}
          currentUserId={currentUserId}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
