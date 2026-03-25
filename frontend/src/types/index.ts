export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean;
  lastSeen: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: User;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  createdAt: string;
  createdById: string;
  members: GroupMember[];
  channels: Channel[];
}

export interface GroupMember {
  id: string;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: string;
  user: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'isOnline'>;
}

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO';
export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ';

export interface MessageStatusEntry {
  userId: string;
  status: MessageStatus;
  updatedAt: string;
}

export interface Message {
  id: string;
  content: string;
  type: MessageType;
  fileUrl: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
  editedAt: string | null;
  senderId: string;
  channelId: string;
  sender: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  statuses: MessageStatusEntry[];
}

export interface UploadResponse {
  url: string;
  thumbnailUrl: string | null;
  type: MessageType;
  size: number;
  originalName: string;
}
