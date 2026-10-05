import React, { useState } from 'react';
import { 
  Smile, 
  Reply, 
  Pin, 
  Bookmark, 
  BookmarkCheck, 
  Edit3, 
  Trash2, 
  Copy, 
  Check, 
  MoreVertical 
} from 'lucide-react';
import { Message } from '../../types';
import { EmojiPicker } from './EmojiPicker';

interface MessageItemProps {
  message: Message;
  currentUserId?: string;
  isRoomOwner?: boolean;
  onReply: (message: Message) => void;
  onReact: (messageId: string, emoji: string) => void;
  onPin: (messageId: string) => void;
  onBookmark: (messageId: string) => void;
  onEdit: (messageId: string, newContent: string) => void;
  onDelete: (messageId: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUserId,
  isRoomOwner,
  onReply,
  onReact,
  onPin,
  onBookmark,
  onEdit,
  onDelete
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [copied, setCopied] = useState(false);

  const isAuthor = currentUserId && message.user_id === currentUserId;
  const canDelete = isAuthor || isRoomOwner;
  const canPin = isAuthor || isRoomOwner;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      id={`msg-${message.id}`}
      className={`group relative flex gap-3 px-4 py-2 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 rounded-xl transition-colors ${
        message.is_pinned ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
      }`}
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 select-none shadow-sm">
        {message.sender_name.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header: Sender Name, Time, Badges */}
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
            {message.sender_name}
          </span>
          <span className="text-[11px] text-slate-400">
            {formatTime(message.created_at)}
          </span>
          {message.is_edited === 1 && (
            <span className="text-[10px] text-slate-400 italic">(edited)</span>
          )}
          {message.is_pinned === 1 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/80 px-1 rounded">
              <Pin className="w-2.5 h-2.5 rotate-45" /> pinned
            </span>
          )}
          {message.is_bookmarked === 1 && (
            <BookmarkCheck className="w-3.5 h-3.5 text-amber-500" />
          )}
        </div>

        {/* Reply Quote Preview */}
        {message.reply_to_id && message.reply_content && (
          <div className="mb-1 pl-2.5 py-0.5 border-l-2 border-blue-500 bg-slate-50 dark:bg-slate-800/60 rounded-r text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
            <Reply className="w-3 h-3 rotate-180 shrink-0 text-blue-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {message.reply_sender_name || 'User'}:
            </span>
            <span className="truncate">{message.reply_content}</span>
          </div>
        )}

        {/* Message Content or Edit Form */}
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="mt-1 space-y-1.5">
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-blue-500 rounded-lg text-sm focus:outline-none"
              autoFocus
            />
            <div className="flex gap-2 text-xs">
              <button
                type="submit"
                className="px-2.5 py-1 bg-blue-600 text-white rounded font-medium"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p className={`text-sm text-slate-800 dark:text-slate-200 break-words whitespace-pre-wrap ${
            message.is_deleted ? 'italic text-slate-400 dark:text-slate-500' : ''
          }`}>
            {message.content}
          </p>
        )}

        {/* Reactions Row */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(message.id, r.emoji)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                  r.hasReacted
                    ? 'bg-blue-100 dark:bg-blue-950/80 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                title={`Reacted by: ${r.users.join(', ')}`}
              >
                <span>{r.emoji}</span>
                <span className="text-[11px] font-semibold">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Menu (shows on hover or tap) */}
      {!message.is_deleted && (
        <div className="absolute right-3 -top-3 hidden group-hover:flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-md p-1 gap-0.5 z-20 animate-in fade-in duration-100">
          {/* Quick Reaction Button */}
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
              title="Add Reaction"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            {showEmojiPicker && (
              <div className="absolute right-0 bottom-full mb-1">
                <EmojiPicker
                  onSelect={(emoji) => onReact(message.id, emoji)}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
            )}
          </div>

          {/* Reply */}
          <button
            onClick={() => onReply(message)}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
            title="Reply"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>

          {/* Copy */}
          <button
            onClick={handleCopy}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
            title="Copy text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Bookmark */}
          <button
            onClick={() => onBookmark(message.id)}
            className={`p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 ${
              message.is_bookmarked ? 'text-amber-500' : 'text-slate-500'
            }`}
            title="Bookmark"
          >
            <Bookmark className="w-3.5 h-3.5" />
          </button>

          {/* Pin */}
          {canPin && (
            <button
              onClick={() => onPin(message.id)}
              className={`p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 ${
                message.is_pinned ? 'text-blue-600' : 'text-slate-500'
              }`}
              title={message.is_pinned ? 'Unpin' : 'Pin'}
            >
              <Pin className="w-3.5 h-3.5 rotate-45" />
            </button>
          )}

          {/* Edit */}
          {isAuthor && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
              title="Edit"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete */}
          {canDelete && (
            <button
              onClick={() => onDelete(message.id)}
              className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
