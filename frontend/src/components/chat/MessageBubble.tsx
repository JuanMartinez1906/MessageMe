import Avatar from '../ui/Avatar';
import { Message, MessageStatus } from '../../types';

interface Props {
  message: Message;
  isOwn: boolean;
  currentUserId: string;
}

function StatusTicks({ statuses, currentUserId }: { statuses: Message['statuses']; currentUserId: string }) {
  // Aggregate worst/best status across all recipients
  const allStatuses = statuses.filter((s) => s.userId !== currentUserId).map((s) => s.status);
  if (allStatuses.length === 0) return <SingleTick />;

  const hasRead = allStatuses.every((s) => s === 'READ');
  const hasDelivered = allStatuses.every((s) => s === 'DELIVERED' || s === 'READ');

  if (hasRead) return <DoubleTick blue />;
  if (hasDelivered) return <DoubleTick />;
  return <DoubleTick gray />;
}

function SingleTick() {
  return <span className="text-[#8696a0] text-xs">✓</span>;
}

function DoubleTick({ blue, gray }: { blue?: boolean; gray?: boolean }) {
  const color = blue ? 'text-[#53bdeb]' : gray ? 'text-[#8696a0]' : 'text-[#8696a0]';
  return <span className={`${color} text-xs`}>✓✓</span>;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message, isOwn, currentUserId }: Props) {
  const bubble = isOwn
    ? 'bg-[#005c4b] rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl ml-auto'
    : 'bg-[#202c33] rounded-tl-sm rounded-tr-2xl rounded-br-2xl rounded-bl-2xl mr-auto';

  return (
    <div className={`flex items-end gap-2 max-w-[75%] ${isOwn ? 'flex-row-reverse self-end' : 'self-start'}`}>
      {!isOwn && (
        <Avatar name={message.sender.displayName} url={message.sender.avatarUrl} size="sm" />
      )}

      <div className={`${bubble} px-3 py-2 shadow-sm`}>
        {!isOwn && (
          <p className="text-teal-400 text-xs font-medium mb-1">{message.sender.displayName}</p>
        )}

        {/* Image */}
        {message.type === 'IMAGE' && message.fileUrl && (
          <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={message.thumbnailUrl ?? message.fileUrl}
              alt="image"
              className="rounded-lg max-w-[240px] mb-1 cursor-pointer hover:opacity-90 transition-opacity"
            />
          </a>
        )}

        {/* File */}
        {message.type === 'FILE' && message.fileUrl && (
          <a
            href={message.fileUrl}
            download
            className="flex items-center gap-2 text-teal-400 hover:text-teal-300 text-sm mb-1"
          >
            <span>📎</span>
            <span className="underline">Descargar archivo</span>
          </a>
        )}

        {/* Audio */}
        {message.type === 'AUDIO' && message.fileUrl && (
          <audio controls src={message.fileUrl} className="max-w-[240px] mb-1" />
        )}

        {/* Text content */}
        {message.content && (
          <p className="text-[#e9edef] text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}

        {/* Timestamp + ticks */}
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[#8696a0] text-[11px]">{formatTime(message.createdAt)}</span>
          {isOwn && <StatusTicks statuses={message.statuses} currentUserId={currentUserId} />}
        </div>
      </div>
    </div>
  );
}
