import { create } from 'zustand';

interface Group {
  id: string;
  name: string;
  createdAt: string;
  members: { user: { id: string; username: string }; role: string }[];
}

interface GroupsState {
  groups: Group[];
  setGroups: (groups: Group[]) => void;
  addGroup: (group: Group) => void;
}

export const useGroupsStore = create<GroupsState>((set) => ({
  groups: [],
  setGroups: (groups) => set({ groups }),
  addGroup: (group) => set((s) => ({ groups: [...s.groups, group] })),
}));
