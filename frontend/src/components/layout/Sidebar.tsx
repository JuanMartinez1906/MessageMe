import { useAuthStore } from '../../store/authStore';
import { disconnectSocket } from '../../services/socket';
import Avatar from '../ui/Avatar';
import GroupList from '../groups/GroupList';

export default function Sidebar() {
  const { user, logout } = useAuthStore();

  function handleLogout() {
    disconnectSocket();
    logout();
  }

  return (
    <aside className="w-80 flex-shrink-0 bg-[#111b21] flex flex-col border-r border-[#374045]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#202c33]">
        <div className="flex items-center gap-3">
          <Avatar name={user?.displayName ?? 'U'} url={user?.avatarUrl} isOnline={true} />
          <div>
            <p className="text-[#e9edef] text-sm font-medium">{user?.displayName}</p>
            <p className="text-[#8696a0] text-xs">@{user?.username}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-[#8696a0] hover:text-red-400 transition-colors p-1"
          title="Cerrar sesión"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      {/* Group list */}
      <div className="flex-1 overflow-hidden">
        <GroupList />
      </div>
    </aside>
  );
}
