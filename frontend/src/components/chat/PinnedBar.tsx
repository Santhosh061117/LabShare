import React from 'react';
import { Pin, X } from 'lucide-react';
import { Message } from '../../types';

interface PinnedBarProps {
  pinnedMessages: Message[];
  onUnpin?: (messageId: string) => void;
  onScrollToMessage?: (messageId: string) => void;
}

export const PinnedBar: React.FC<PinnedBarProps> = ({
  pinnedMessages,
  onUnpin,
  onScrollToMessage
}) => {
  if (pinnedMessages.length === 0) return null;

  const latestPinned = pinnedMessages[pinnedMessages.length - 1];

  return (
    <div className="bg-blue-50/90 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900/60 px-4 py-2 flex items-center justify-between gap-3 text-xs">
      <div
        onClick={() => onScrollToMessage?.(latestPinned.id)}
        className="flex items-center gap-2 cursor-pointer truncate flex-1"
      >
        <Pin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 rotate-45" />
        <span className="font-semibold text-blue-900 dark:text-blue-200">
          Pinned ({pinnedMessages.length}):
        </span>
        <span className="truncate text-slate-700 dark:text-slate-300">
          <strong>{latestPinned.sender_name}:</strong> {latestPinned.content}
        </span>
      </div>

      {onUnpin && (
        <button
          onClick={() => onUnpin(latestPinned.id)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
          title="Unpin message"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
