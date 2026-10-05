import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { ClipboardItem } from '../../types';
import { Copy, Check, Send, Trash2, ShieldAlert } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface ClipboardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: ClipboardItem[];
  onShareText: (text: string) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

export const ClipboardDrawer: React.FC<ClipboardDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onShareText,
  onDeleteItem
}) => {
  const { success } = useToast();
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setIsSubmitting(true);
    try {
      await onShareText(inputText.trim());
      setInputText('');
      success('Snippet shared to room clipboard!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    success('Copied to your clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Room Clipboard & Text Sharing" maxWidth="lg">
      <div className="space-y-4">
        {/* Privacy Note */}
        <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-blue-600" />
          <span>
            LabShare never secretly accesses your clipboard. Paste snippets below to share with your lab mates.
          </span>
        </div>

        {/* Input Form */}
        <form onSubmit={handleShare} className="space-y-2">
          <textarea
            rows={3}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste code snippet, lab command, terminal output, or text to share..."
            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              isLoading={isSubmitting}
              disabled={!inputText.trim()}
              icon={<Send className="w-3.5 h-3.5" />}
            >
              Share Snippet
            </Button>
          </div>
        </form>

        {/* Snippets List */}
        <div className="space-y-3 pt-2 max-h-80 overflow-y-auto">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Shared Snippets ({items.length})
          </h4>

          {items.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              No snippets shared yet in this room.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {item.sender_name}
                  </span>
                  <span>{new Date(item.created_at).toLocaleTimeString()}</span>
                </div>

                <pre className="p-2.5 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">
                  {item.content}
                </pre>

                <div className="flex items-center justify-between pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs py-1"
                    onClick={() => handleCopy(item.id, item.content)}
                    icon={
                      copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {copiedId === item.id ? 'Copied!' : 'Copy Text'}
                  </Button>

                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg"
                    title="Delete snippet"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};
