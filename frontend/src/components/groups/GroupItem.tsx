import { Group, Channel } from '../../types';
import Avatar from '../ui/Avatar';
import { useChatStore } from '../../store/chatStore';
import { getSocket } from '../../services/socket';

interface Props {
  group: Group;
  isActive: boolean;
  onClick: () => void;
}

export default function GroupItem({ group, isActive, onClick }: Props) {
  const { activeChannel, setActiveChannel } = useChatStore();
  const isExpanded = isActive;
  const onlineCount = group.members.filter((m) => m.user.isOnline).length;

  function selectChannel(channel: Channel) {
    const socket = getSocket();
    if (activeChannel) socket?.emit('leave-channel', { channelId: activeChannel.id });
    setActiveChannel(channel);
    socket?.emit('join-channel', { channelId: channel.id });
  }

  return (
    <div>
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-[#2a3942] transition-colors ${
          isActive ? 'bg-[#2a3942]' : ''
        }`}
      >
        <Avatar name={group.name} url={group.avatarUrl} isOnline={onlineCount > 0} />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[#e9edef] text-sm font-medium truncate">{group.name}</p>
          <p className="text-[#8696a0] text-xs truncate">
            {onlineCount} en línea · {group.members.length} miembros
          </p>
        </div>
      </button>

      {isExpanded && group.channels.length > 0 && (
        <div className="pl-4 border-l border-[#374045] ml-6">
          {group.channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => selectChannel(ch)}
              className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                activeChannel?.id === ch.id
                  ? 'bg-teal-700/40 text-teal-300'
                  : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]'
              }`}
            >
              # {ch.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
