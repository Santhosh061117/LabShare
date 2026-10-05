export interface User {
  id: string;
  username: string;
  displayName: string;
  role: string;
  avatarUrl?: string;
  createdAt?: number;
}

export interface Device {
  id: string;
  name?: string;
  device_name?: string;
  ip_address?: string;
  is_trusted?: number;
  isTrusted?: boolean;
  last_active_at?: number;
  created_at?: number;
  is_current?: number;
}

export interface RoomMember {
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  name: string;
  username?: string;
  joinedAt: number;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  ownerId?: string;
  owner_id?: string;
  isPasswordProtected?: boolean;
  is_password_protected?: number;
  maxMembers?: number;
  max_members?: number;
  isTemporary?: boolean;
  is_temporary?: number;
  isClosed?: boolean;
  is_closed?: number;
  expiresAt?: number | null;
  expires_at?: number | null;
  memberCount?: number;
  member_count?: number;
  messageCount?: number;
  message_count?: number;
  isMember?: boolean | number;
  is_member?: number;
  isOwner?: boolean;
  members?: RoomMember[];
  createdAt?: number;
  created_at?: number;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  sender_name: string;
  content: string;
  reply_to_id?: string | null;
  reply_content?: string | null;
  reply_sender_name?: string | null;
  is_pinned?: number;
  is_edited?: number;
  is_deleted?: number;
  created_at: number;
  updated_at: number;
  reactions?: MessageReaction[];
  is_bookmarked?: number;
}

export interface FileRecord {
  id: string;
  room_id: string | null;
  uploader_id: string;
  uploader_name: string;
  original_name: string;
  stored_name?: string;
  file_size: number;
  mime_type: string;
  is_temporary: number;
  expires_at: number | null;
  download_count: number;
  created_at: number;
}

export interface ClipboardItem {
  id: string;
  room_id: string;
  user_id: string;
  sender_name: string;
  content: string;
  created_at: number;
}

export interface ServerHealth {
  status: 'ok' | 'error';
  app: string;
  version: string;
  uptimeSeconds: number;
  timestamp: number;
  environment: {
    platform: string;
    isTermux: boolean;
    nodeVersion: string;
    cpuArch: string;
    totalMemoryBytes: number;
    freeMemoryBytes: number;
    processMemoryBytes: number;
  };
  metrics: {
    connectedClients: number;
    activeRooms: number;
    registeredUsers: number;
    storageUsedBytes: number;
    totalFiles: number;
  };
}

export interface StorageStats {
  totalBytes: number;
  fileCount: number;
  largestFiles: FileRecord[];
  roomBreakdown: { room_id: string | null; count: number; total_bytes: number }[];
}
