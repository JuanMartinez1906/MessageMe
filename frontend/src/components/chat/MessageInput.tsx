import { useState, useRef, useCallback } from 'react';
import { getSocket } from '../../services/socket';
import { uploadAttachment } from '../../services/upload';

interface Props {
  channelId: string;
}

export default function MessageInput({ channelId }: Props) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emitTyping = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('user-typing', { channelId });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('user-stop-typing', { channelId });
    }, 2000);
  }, [channelId]);

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    emitTyping();
  }

  function sendText() {
    const content = text.trim();
    if (!content) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit('send-message', { channelId, content, type: 'TEXT' });
    setText('');
    socket.emit('user-stop-typing', { channelId });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const attachment = await uploadAttachment(file);
      const socket = getSocket();
      if (socket) {
        socket.emit('send-message', {
          channelId,
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

  return (
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
        onChange={handleTextChange}
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
        onClick={sendText}
        disabled={!text.trim()}
        className="bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 transition-colors"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </div>
  );
}
