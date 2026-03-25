import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Group } from '../../types';
import Avatar from '../ui/Avatar';

interface Props {
  group: Group;
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
}

export default function MembersPanel({ group, currentUserId, isAdmin, onClose }: Props) {
  const [removing, setRemoving] = useState<string | null>(null);
  const queryClient = useQueryClient();

  async function removeMember(userId: string) {
    if (removing) return;
    setRemoving(userId);
    try {
      await api.delete(`/groups/${group.id}/members/${userId}`);
      await queryClient.invalidateQueries({ queryKey: ['groups'] });
    } catch {
      // ignore
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="w-64 flex-shrink-0 bg-[#111b21] border-l border-[#374045] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#374045]">
        <span className="text-[#e9edef] text-sm font-semibold">
          Miembros ({group.members.length})
        </span>
        <button onClick={onClose} className="text-[#8696a0] hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {group.members.map((member) => (
          <div key={member.id} className="flex items-center gap-3 px-4 py-2 hover:bg-[#202c33]">
            <div className="relative flex-shrink-0">
              <Avatar name={member.user.displayName} url={member.user.avatarUrl} size="sm" />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#111b21] ${
                  member.user.isOnline ? 'bg-green-400' : 'bg-[#8696a0]'
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#e9edef] text-sm truncate">{member.user.displayName}</p>
              <p className="text-[#8696a0] text-xs truncate">
                @{member.user.username}
                {member.role === 'ADMIN' && (
                  <span className="ml-1 text-teal-400">· Admin</span>
                )}
              </p>
            </div>
            {isAdmin && member.user.id !== currentUserId && (
              <button
                onClick={() => removeMember(member.user.id)}
                disabled={removing === member.user.id}
                className="text-[#8696a0] hover:text-red-400 disabled:opacity-40 transition-colors flex-shrink-0"
                title="Eliminar miembro"
              >
                {removing === member.user.id ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                  </svg>
                )}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
