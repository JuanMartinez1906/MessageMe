import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useChatStore } from '../../store/chatStore';
import { User, DirectConversation } from '../../types';
import Avatar from '../ui/Avatar';

interface Props {
  onClose: () => void;
}

type SearchUser = Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'isOnline'>;

export default function NewDmModal({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [starting, setStarting] = useState(false);
  const { addConversation, setActiveConversation } = useChatStore();

  const { data: results = [] } = useQuery<SearchUser[]>({
    queryKey: ['users-search', query],
    queryFn: async () => {
      if (query.trim().length < 1) return [];
      const { data } = await api.get('/users/search', { params: { q: query } });
      return data;
    },
    enabled: query.trim().length >= 1,
  });

  async function startConversation(user: SearchUser) {
    if (starting) return;
    setStarting(true);
    try {
      const { data } = await api.post<DirectConversation>('/direct/conversations', {
        participantId: user.id,
      });
      addConversation(data);
      setActiveConversation(data);
      onClose();
    } catch {
      // ignore
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#202c33] rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#374045]">
          <h2 className="text-[#e9edef] font-semibold">Nuevo mensaje directo</h2>
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
            {query.trim().length >= 1 && results.length === 0 && (
              <p className="text-[#8696a0] text-sm text-center py-4">Sin resultados</p>
            )}
            {results.map((user) => (
              <button
                key={user.id}
                onClick={() => startConversation(user)}
                disabled={starting}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#2a3942] transition-colors text-left"
              >
                <Avatar name={user.displayName} url={user.avatarUrl} isOnline={user.isOnline} size="sm" />
                <div>
                  <p className="text-[#e9edef] text-sm font-medium">{user.displayName}</p>
                  <p className="text-[#8696a0] text-xs">@{user.username}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
