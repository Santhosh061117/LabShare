import React from 'react';

const COMMON_EMOJIS = [
  '👍', '❤️', '🔥', '😂', '🎉', '🚀', '👀', '💻',
  '💡', '💯', '👏', '⚡', '❓', '✅', '❌', '🙌'
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2.5 z-50 animate-zoom-in max-w-[calc(100vw-2.5rem)] sm:max-w-none overflow-x-auto">
      <div className="grid grid-cols-8 gap-1.5">
        {COMMON_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center text-lg hover:scale-125 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-transform"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
