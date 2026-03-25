import { useEffect, useRef } from 'react';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  sender: { id: string; username: string };
}

interface Props {
  messages: Message[];
  currentUserId: string;
}

export default function MessageList({ messages, currentUserId }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{ overflowY: 'auto', height: '400px', border: '1px solid #ccc', padding: '8px' }}>
      {messages.map((msg) => (
        <div key={msg.id} style={{ textAlign: msg.sender.id === currentUserId ? 'right' : 'left', marginBottom: '8px' }}>
          <small>{msg.sender.username}</small>
          <p>{msg.content}</p>
          <small>{new Date(msg.createdAt).toLocaleTimeString()}</small>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
