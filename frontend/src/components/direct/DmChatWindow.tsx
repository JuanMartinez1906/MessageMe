import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { DirectMessage, DirectMessageStatus } from '../../types';
import { uploadAttachment } from '../../services/upload';
import Avatar from '../ui/Avatar';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function StatusTick({ status }: { status: DirectMessageStatus }) {
  if (status === 'READ') {
    return (
      <span className="inline-flex text-[#53bdeb]">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        <svg className="w-3.5 h-3.5 -ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (status === 'DELIVERED') {
    return (
      <span className="inline-flex text-[#8696a0]">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        <svg className="w-3.5 h-3.5 -ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <svg className="w-3.5 h-3.5 text-[#8696a0] inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function DmBubble({ message, isOwn }: { message: DirectMessage; isOwn: boolean }) {
  const bubble = isOwn
    ? 'bg-[#005c4b] rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl ml-auto'
    : 'bg-[#202c33] rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl mr-auto';

  return (
    <div className={`flex items-end gap-2 max-w-[75%] ${isOwn ? 'flex-row-reverse self-end' : 'self-start'}`}>
      {!isOwn && (
        <Avatar name={message.sender.displayName} url={message.sender.avatarUrl} size="sm" />
      )}
      <div className={`${bubble} px-3 py-2 shadow-sm`}>
        {message.type === 'IMAGE' && message.fileUrl && (
          <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={message.fileUrl}
              alt="image"
              className="rounded-lg max-w-[240px] mb-1 cursor-pointer hover:opacity-90"
            />
          </a>
        )}
        {message.type === 'FILE' && message.fileUrl && (
          <a
            href={message.fileUrl}
            download
            className="flex items-center gap-2 text-teal-400 hover:text-teal-300 text-sm mb-1"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span className="underline">Descargar archivo</span>
          </a>
        )}
        {message.type === 'AUDIO' && message.fileUrl && (
          <audio controls src={message.fileUrl} className="max-w-[240px] mb-1" />
        )}
        {message.content && (
          <p className="text-[#e9edef] text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[#8696a0] text-[11px]">{formatTime(message.createdAt)}</span>
          {isOwn && <StatusTick status={message.status} />}
        </div>
      </div>
    </div>
  );
}

export default function DmChatWindow() {
  const { activeConversation, directMessages, setDirectMessages, addDirectMessage } = useChatStore();
  const myId = useAuthStore((s) => s.user?.id);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const other = activeConversation?.participants.find((p) => p.userId !== myId)?.user;

  // Load message history
  const { data: history } = useQuery<DirectMessage[]>({
    queryKey: ['dm-messages', activeConversation?.id],
    queryFn: async () => {
      const { data } = await api.get(`/direct/conversations/${activeConversation!.id}/messages`);
      return data;
    },
    enabled: !!activeConversation,
  });

  useEffect(() => {
    if (history) setDirectMessages(history);
  }, [history]);

  // Join conversation room via socket (wait for connection if not yet established)
  useEffect(() => {
    if (!activeConversation) return;
    const socket = getSocket();
    if (!socket) return;

    const join = () => socket.emit('join-conversation', { conversationId: activeConversation.id });

    if (socket.connected) {
      join();
    } else {
      socket.once('connect', join);
      return () => { socket.off('connect', join); };
    }
  }, [activeConversation?.id]);

  // Mark received messages as read
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !activeConversation) return;
    directMessages.forEach((m) => {
      if (m.senderId !== myId && m.status !== 'READ') {
        socket.emit('direct-message-read', { messageId: m.id });
      }
    });
  }, [directMessages, activeConversation?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [directMessages]);

  function sendMessage() {
    const content = text.trim();
    if (!content || !activeConversation) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit('send-direct-message', {
      conversationId: activeConversation.id,
      content,
      type: 'TEXT',
    });
    setText('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;
    setUploading(true);
    try {
      const attachment = await uploadAttachment(file);
      const socket = getSocket();
      if (socket) {
        socket.emit('send-direct-message', {
          conversationId: activeConversation.id,
          content: attachment.originalName,
          type: attachment.type,
          fileUrl: attachment.downloadUrl,
        });
      }
    } catch (err: any) {
      alert(err.response?.data?.message ?? err.message ?? 'Error al subir archivo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (!activeConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0b141a]">
        <p className="text-[#8696a0] text-sm">Selecciona una conversación</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0b141a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#202c33] border-b border-[#374045]">
        <Avatar
          name={other?.displayName ?? '?'}
          url={other?.avatarUrl ?? null}
          isOnline={other?.isOnline}
          size="md"
        />
        <div>
          <p className="text-[#e9edef] font-medium text-sm">{other?.displayName}</p>
          <p className="text-[#8696a0] text-xs">
            {other?.isOnline ? 'En línea' : 'Desconectado'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
        {directMessages.map((m) => (
          <DmBubble key={m.id} message={m} isOwn={m.senderId === myId} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 px-4 py-3 bg-[#202c33]">
        {/* File attach */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.mp3,.ogg,.m4a"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-[#8696a0] hover:text-[#e9edef] transition-colors p-2 flex-shrink-0"
          title="Adjuntar archivo"
        >
          {uploading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          )}
        </button>

        {/* Text area */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          rows={1}
          className="flex-1 bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] rounded-lg px-4 py-2.5 text-sm resize-none outline-none max-h-32 overflow-y-auto"
          style={{ height: 'auto' }}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = 'auto';
            t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
          }}
        />

        {/* Send button */}
        <button
          onClick={sendMessage}
          disabled={!text.trim()}
          className="bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
