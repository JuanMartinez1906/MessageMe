import { useState } from 'react';
import { Group, Channel } from '../../types';
import Avatar from '../ui/Avatar';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../services/socket';
import { api } from '../../services/api';
import AddMemberModal from './AddMemberModal';

interface Props {
  group: Group;
  isActive: boolean;
  onClick: () => void;
}

export default function GroupItem({ group, isActive, onClick }: Props) {
  const { activeChannel, setActiveChannel, removeGroup } = useChatStore();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [showAddMember, setShowAddMember] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isExpanded = isActive;
  const onlineCount = group.members.filter((m) => m.user.isOnline).length;
  const isAdmin = group.members.find((m) => m.user.id === currentUserId)?.role === 'ADMIN';

  async function handleDelete() {
    const ok = window.confirm(
      `¿Borrar el grupo "${group.name}"? Esto elimina sus canales y no se puede deshacer.`
    );
    if (!ok || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/groups/${group.id}`);
      removeGroup(group.id);
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'No se pudo borrar el grupo');
      setDeleting(false);
    }
  }

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

      {isExpanded && (
        <>
          {group.channels.length > 0 && (
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

          {isAdmin && (
            <div className="pl-6 pr-3 pb-2 flex flex-col gap-1">
              <button
                onClick={() => setShowAddMember(true)}
                className="flex items-center gap-1.5 text-[#8696a0] hover:text-teal-400 text-xs transition-colors py-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Agregar miembro
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 text-[#8696a0] hover:text-red-400 disabled:opacity-50 text-xs transition-colors py-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                </svg>
                {deleting ? 'Borrando...' : 'Borrar grupo'}
              </button>
            </div>
          )}
        </>
      )}

      {showAddMember && (
        <AddMemberModal group={group} onClose={() => setShowAddMember(false)} />
      )}
    </div>
  );
}
