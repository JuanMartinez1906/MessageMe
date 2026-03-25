import { useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import GroupItem from './GroupItem';
import CreateGroupModal from './CreateGroupModal';

export default function GroupList() {
  const { groups, activeGroup, setActiveGroup } = useChatStore();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#374045]">
        <span className="text-[#8696a0] text-xs font-semibold uppercase tracking-wider">Grupos</span>
        <button
          onClick={() => setShowCreate(true)}
          className="text-[#8696a0] hover:text-teal-400 transition-colors"
          title="Crear grupo"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <p className="text-[#8696a0] text-sm text-center py-8 px-4">
            No tienes grupos aún.{' '}
            <button onClick={() => setShowCreate(true)} className="text-teal-400 hover:underline">
              Crea uno
            </button>
          </p>
        ) : (
          groups.map((g) => (
            <GroupItem
              key={g.id}
              group={g}
              isActive={activeGroup?.id === g.id}
              onClick={() => setActiveGroup(activeGroup?.id === g.id ? null : g)}
            />
          ))
        )}
      </div>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
