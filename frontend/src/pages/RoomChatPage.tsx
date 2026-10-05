import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { 
  Users, 
  KeyRound, 
  Copy, 
  Check, 
  QrCode, 
  LogOut, 
  ArrowLeft, 
  ClipboardCopy, 
  FolderArchive, 
  Pin,
  Lock,
  Clock
} from 'lucide-react';
import { api, getApiBaseUrl } from '../services/api';
import { wsManager } from '../services/ws';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFileUpload } from '../hooks/useFileUpload';
import { Room, Message, RoomMember, FileRecord, ClipboardItem } from '../types';
import { MessageItem } from '../components/chat/MessageItem';
import { MessageInput } from '../components/chat/MessageInput';
import { PinnedBar } from '../components/chat/PinnedBar';
import { MemberListDrawer } from '../components/rooms/MemberListDrawer';
import { ClipboardDrawer } from '../components/clipboard/ClipboardDrawer';
import { FilePreviewModal } from '../components/files/FilePreviewModal';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';

interface RoomChatPageProps {
  roomId: string;
  onNavigate: (page: string, params?: any) => void;
}

export const RoomChatPage: React.FC<RoomChatPageProps> = ({ roomId, onNavigate }) => {
  const { user } = useAuth();
  const { success, error, info } = useToast();
  const { uploadFile, uploads, cancelUpload } = useFileUpload();

  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);

  // Modals & Drawers
  const [showMembers, setShowMembers] = useState(false);
  const [showClipboard, setShowClipboard] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [roomQrUrl, setRoomQrUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>([]);

  const messageListEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const isOwner = user && room && (room.owner_id === user.id || room.ownerId === user.id);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    isNearBottomRef.current = distanceToBottom < 120;
  };

  const scrollToBottom = (force = false) => {
    if (force || isNearBottomRef.current) {
      messageListEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const loadRoomData = useCallback(async () => {
    try {
      const roomRes = await api.getRoom(roomId);
      setRoom(roomRes.room);
      setMembers(roomRes.room.members || []);

      const msgRes = await api.getMessages(roomId);
      const msgs: Message[] = msgRes.messages || [];
      setMessages(msgs);
      setPinnedMessages(msgs.filter((m) => m.is_pinned === 1));

      const clipRes = await api.getClipboard(roomId);
      setClipboardItems(clipRes.items || []);

      // Generate Room QR code with full join link including server URL
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      const server = getApiBaseUrl();
      const shareUrl = `${origin}${pathname}?room=${roomRes.room.code}&server=${encodeURIComponent(server)}`;
      const qrUrl = await QRCode.toDataURL(shareUrl, {
        width: 250,
        margin: 2
      });
      setRoomQrUrl(qrUrl);
    } catch (err: any) {
      error(err.message || 'Failed to load room details.');
    } finally {
      setLoading(false);
    }
  }, [roomId, error]);

  useEffect(() => {
    loadRoomData();

    // Tell WebSocket we joined this room
    wsManager.send('JOIN_ROOM', { roomId, guestName: user?.displayName || 'Guest' });

    // WebSocket Listeners
    const unMsg = wsManager.on('NEW_MESSAGE', (payload: Message) => {
      setMessages((prev) => [...prev, payload]);
      if (payload.is_pinned) {
        setPinnedMessages((prev) => [...prev, payload]);
      }
      setTimeout(() => scrollToBottom(false), 100);
    });

    const unEdit = wsManager.on('MESSAGE_EDITED', (payload: any) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? { ...m, content: payload.content, is_edited: 1, updated_at: payload.updatedAt }
            : m
        )
      );
    });

    const unDel = wsManager.on('MESSAGE_DELETED', (payload: any) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? { ...m, is_deleted: 1, content: '[Message deleted]' }
            : m
        )
      );
    });

    const unReact = wsManager.on('MESSAGE_REACTION_UPDATED', (payload: any) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? { ...m, reactions: payload.reactions }
            : m
        )
      );
    });

    const unPin = wsManager.on('MESSAGE_PIN_UPDATED', (payload: any) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? { ...m, is_pinned: payload.isPinned ? 1 : 0 }
            : m
        )
      );
      if (payload.isPinned) {
        setPinnedMessages((prev) => {
          const found = messages.find((m) => m.id === payload.messageId);
          return found ? [...prev, { ...found, is_pinned: 1 }] : prev;
        });
      } else {
        setPinnedMessages((prev) => prev.filter((m) => m.id !== payload.messageId));
      }
    });

    const unTyping = wsManager.on('USER_TYPING', (payload: any) => {
      if (payload.roomId === roomId) {
        const name = payload.displayName || 'Someone';
        if (payload.isTyping) {
          setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
        } else {
          setTypingUsers((prev) => prev.filter((n) => n !== name));
        }
      }
    });

    const unJoin = wsManager.on('MEMBER_JOINED', (payload: any) => {
      info(`${payload.name} joined the room.`);
      loadRoomData();
    });

    const unKick = wsManager.on('MEMBER_KICKED', (payload: any) => {
      if (payload.userId === user?.id) {
        error('You have been removed from this room by the owner.');
        onNavigate('rooms');
      } else {
        loadRoomData();
      }
    });

    const unClip = wsManager.on('CLIPBOARD_ITEM_SHARED', (payload: ClipboardItem) => {
      setClipboardItems((prev) => [payload, ...prev]);
      info(`New snippet shared by ${payload.sender_name}`);
    });

    return () => {
      wsManager.send('LEAVE_ROOM', { roomId });
      unMsg();
      unEdit();
      unDel();
      unReact();
      unPin();
      unTyping();
      unJoin();
      unKick();
      unClip();
    };
  }, [roomId, loadRoomData, user, onNavigate, error, info]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSendMessage = async (content: string, replyToId?: string) => {
    try {
      await api.sendMessage(roomId, { content, replyToId });
    } catch (err: any) {
      error(err.message || 'Failed to send message.');
    }
  };

  const handleAttachFiles = async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const uploaded = await uploadFile(file, { roomId });
        success(`Uploaded ${file.name}!`);
        // Send a chat notification with file details
        await api.sendMessage(roomId, {
          content: `📁 Uploaded file: ${uploaded.original_name} (${(uploaded.file_size / (1024 * 1024)).toFixed(1)} MB)`
        });
      } catch (err: any) {
        error(`Failed to upload ${file.name}`);
      }
    }
  };

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    success(`Copied room code: ${room.code}`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleKickMember = async (targetUserId: string) => {
    try {
      await api.kickMember(roomId, targetUserId);
      success('Member removed.');
      setMembers((prev) => prev.filter((m) => m.userId !== targetUserId));
    } catch (err: any) {
      error(err.message || 'Failed to remove member.');
    }
  };

  const handleShareClipboard = async (content: string) => {
    await api.shareClipboard(roomId, content);
  };

  const handleDeleteClipboard = async (id: string) => {
    await api.deleteClipboard(id);
    setClipboardItems((prev) => prev.filter((item) => item.id !== id));
  };

  if (loading || !room) {
    return (
      <div className="h-[75vh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Loading lab room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-9.5rem)] lg:h-[calc(100vh-8rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => onNavigate('rooms')}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Back to rooms"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate m-0">
                {room.name}
              </h2>
              {room.is_temporary === 1 && (
                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                  Temp
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate">
              {room.description || 'College Lab Collaborative Chat & Code Sharing'}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Room Code Badge */}
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-mono font-bold text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 transition-colors"
            title="Click to copy room code"
          >
            {room.code}
            {copiedCode ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* QR Code Button */}
          <button
            onClick={() => setShowQrModal(true)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Show Room QR Code for Lab"
          >
            <QrCode className="w-4 h-4" />
          </button>

          {/* Room Clipboard Drawer Trigger */}
          <button
            onClick={() => setShowClipboard(true)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Shared Clipboard Snippets"
          >
            <ClipboardCopy className="w-4 h-4" />
          </button>

          {/* Room Files Link */}
          <button
            onClick={() => onNavigate('files', { roomId })}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Room Files"
          >
            <FolderArchive className="w-4 h-4" />
          </button>

          {/* Members Button */}
          <button
            onClick={() => setShowMembers(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            title="View Members"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline font-semibold">{members.length}</span>
          </button>
        </div>
      </div>

      {/* Pinned Announcements Bar */}
      <PinnedBar
        pinnedMessages={pinnedMessages}
        onUnpin={isOwner ? (id) => api.togglePin(roomId, id) : undefined}
      />

      {/* Messages Scroll Area */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8">
            <KeyRound className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2" />
            <h4 className="font-semibold text-slate-700 dark:text-slate-300">
              Welcome to {room.name}!
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Invite your classmates with code <strong>{room.code}</strong>. Share files, ask lab questions, or exchange code snippets.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              currentUserId={user?.id}
              isRoomOwner={!!isOwner}
              onReply={(m) => setReplyingTo(m)}
              onReact={(msgId, emoji) => api.toggleReaction(roomId, msgId, emoji)}
              onPin={(msgId) => api.togglePin(roomId, msgId)}
              onBookmark={(msgId) => api.toggleBookmark(roomId, msgId)}
              onEdit={(msgId, content) => api.editMessage(roomId, msgId, content)}
              onDelete={(msgId) => api.deleteMessage(roomId, msgId)}
            />
          ))
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-1 text-xs text-slate-400 italic flex items-center gap-2 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            <span>
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}

        <div ref={messageListEndRef} />
      </div>

      {/* Message Input Bar */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onAttachFile={handleAttachFiles}
        onOpenClipboard={() => setShowClipboard(true)}
        onTyping={(isTyping) => wsManager.send('TYPING', { roomId, isTyping, guestName: user?.displayName })}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />

      {/* Members Modal */}
      <MemberListDrawer
        isOpen={showMembers}
        onClose={() => setShowMembers(false)}
        members={members}
        isOwner={!!isOwner}
        onKickMember={handleKickMember}
        maxMembers={room.max_members || 50}
      />

      {/* Clipboard Snippets Drawer */}
      <ClipboardDrawer
        isOpen={showClipboard}
        onClose={() => setShowClipboard(false)}
        items={clipboardItems}
        onShareText={handleShareClipboard}
        onDeleteItem={handleDeleteClipboard}
      />

      {/* Room QR Code Modal */}
      <Modal isOpen={showQrModal} onClose={() => setShowQrModal(false)} title="Room Join QR Code">
        <div className="text-center py-4 space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Project this QR code on the lab projector or show classmates to join instantly:
          </p>

          {roomQrUrl && (
            <div className="inline-block p-4 bg-white rounded-2xl shadow-md border border-slate-200">
              <img src={roomQrUrl} alt="Room QR" className="w-56 h-56 mx-auto" />
              <p className="mt-2 text-xl font-mono font-bold tracking-widest text-slate-900">
                {room.code}
              </p>
            </div>
          )}

          <div>
            <Button size="sm" onClick={handleCopyCode}>
              Copy Room Code
            </Button>
          </div>
        </div>
      </Modal>

      {/* File Preview Modal */}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
};
