import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Group } from '../../types';
import Avatar from '../ui/Avatar';

interface Props {
  group: Group;
  onClose: () => void;
}

type SearchUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean;
};

export default function AddMemberModal({ group, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const existingIds = new Set(group.members.map((m) => m.user.id));

  const { data: results = [] } = useQuery<SearchUser[]>({
    queryKey: ['users-search', query],
    queryFn: async () => {
      if (query.trim().length < 1) return [];
      const { data } = await api.get('/users/search', { params: { q: query } });
      return data;
    },
    enabled: query.trim().length >= 1,
  });

  const filtered = results.filter((u) => !existingIds.has(u.id) && !added.has(u.id));

  async function addMember(userId: string) {
    if (adding) return;
    setAdding(userId);
    try {
      await api.post(`/groups/${group.id}/members`, { userId });
      setAdded((prev) => new Set(prev).add(userId));
      await queryClient.invalidateQueries({ queryKey: ['groups'] });
    } catch {
      // ignore
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#202c33] rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#374045]">
          <h2 className="text-[#e9edef] font-semibold">Agregar miembro</h2>
          <button onClick={onClose} className="text-[#8696a0] hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o usuario..."
            autoFocus
            className="w-full bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
          />

          <div className="mt-3 max-h-64 overflow-y-auto space-y-1">
            {query.trim().length >= 1 && filtered.length === 0 && (
              <p className="text-[#8696a0] text-sm text-center py-4">Sin resultados</p>
            )}
            {filtered.map((user) => (
              <div key={user.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#2a3942]">
                <Avatar name={user.displayName} url={user.avatarUrl} isOnline={user.isOnline} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[#e9edef] text-sm font-medium truncate">{user.displayName}</p>
                  <p className="text-[#8696a0] text-xs">@{user.username}</p>
                </div>
                <button
                  onClick={() => addMember(user.id)}
                  disabled={adding === user.id}
                  className="text-xs bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-3 py-1 rounded-md transition-colors flex-shrink-0"
                >
                  {adding === user.id ? '...' : 'Agregar'}
                </button>
              </div>
            ))}
          </div>

          {added.size > 0 && (
            <p className="text-teal-400 text-xs text-center mt-3">
              {added.size} miembro{added.size > 1 ? 's' : ''} agregado{added.size > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
