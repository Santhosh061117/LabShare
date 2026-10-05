import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  Zap, 
  QrCode, 
  KeyRound, 
  Send, 
  Copy, 
  Check, 
  Download, 
  Clock, 
  UploadCloud, 
  FileText, 
  Sparkles, 
  X,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api, getApiBaseUrl } from '../services/api';
import { wsManager } from '../services/ws';
import { useToast } from '../context/ToastContext';
import { useFileUpload } from '../hooks/useFileUpload';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import type { FileRecord, ClipboardItem } from '../types';

interface QuickTransferPageProps {
  initialCode?: string;
}

export const QuickTransferPage: React.FC<QuickTransferPageProps> = ({ initialCode }) => {
  const { success, error, info } = useToast();
  const { uploadFile, uploads, cancelUpload, clearCompleted } = useFileUpload();

  // Session state
  const [activeSession, setActiveSession] = useState<{ id: string; code: string; expiresAt: number } | null>(null);
  const [sessionQrUrl, setSessionQrUrl] = useState<string | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Content state
  const [transferredFiles, setTransferredFiles] = useState<FileRecord[]>([]);
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>([]);
  const [snippetText, setSnippetText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-join if initialCode is provided via URL parameter
  useEffect(() => {
    if (initialCode && !activeSession) {
      setJoinCodeInput(initialCode);
      const clean = initialCode.trim().toUpperCase();
      api.getQuickTransfer(clean)
        .then(async (res) => {
          setActiveSession(res.room);
          setTransferredFiles(res.files || []);
          setClipboardItems(res.clipboard || []);
          const origin = window.location.origin;
          const pathname = window.location.pathname;
          const server = getApiBaseUrl();
          const shareUrl = `${origin}${pathname}?quick=${res.room.code}&server=${encodeURIComponent(server)}`;
          const qr = await QRCode.toDataURL(shareUrl, { width: 260, margin: 2 });
          setSessionQrUrl(qr);
          success(`Connected to Quick Transfer session: ${clean}`);
        })
        .catch(() => {});
    }
  }, [initialCode]);

  // Countdown timer for session expiry
  useEffect(() => {
    if (!activeSession) return;

    const timer = setInterval(() => {
      const remaining = activeSession.expiresAt - Date.now();
      if (remaining <= 0) {
        setTimeLeft('Expired');
        clearInterval(timer);
      } else {
        const h = Math.floor(remaining / (1000 * 60 * 60));
        const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((remaining % (1000 * 60)) / 1000);
        setTimeLeft(`${h}h ${m}m ${s}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSession]);

  // WebSocket signaling for instant peer transfer updates
  useEffect(() => {
    if (!activeSession) return;

    wsManager.send('JOIN_ROOM', { roomId: activeSession.id, guestName: 'Quick Peer' });

    const unFile = wsManager.on('NEW_FILE', (file: FileRecord) => {
      if (file.room_id === activeSession.id) {
        setTransferredFiles((prev) => [file, ...prev]);
        info(`New file received: ${file.original_name}`);
      }
    });

    const unClip = wsManager.on('CLIPBOARD_ITEM_SHARED', (item: ClipboardItem) => {
      if (item.room_id === activeSession.id) {
        setClipboardItems((prev) => [item, ...prev]);
        info('New clipboard text snippet received!');
      }
    });

    return () => {
      wsManager.send('LEAVE_ROOM', { roomId: activeSession.id });
      unFile();
      unClip();
    };
  }, [activeSession, info]);

  // Helper to generate full connect URL for seamless mobile camera scanning
  const generateShareUrl = (code: string) => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const server = getApiBaseUrl();
    return `${origin}${pathname}?quick=${code}&server=${encodeURIComponent(server)}`;
  };

  // Create Quick Session
  const handleCreateSession = async () => {
    setIsCreating(true);
    try {
      const res = await api.createQuickTransfer();
      const s = res.room;
      setActiveSession(s);

      const shareUrl = generateShareUrl(s.code);
      const qr = await QRCode.toDataURL(shareUrl, {
        width: 260,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' }
      });
      setSessionQrUrl(qr);

      const data = await api.getQuickTransfer(s.code);
      setTransferredFiles(data.files || []);
      setClipboardItems(data.clipboard || []);

      success(`Quick Transfer session created! Code: ${s.code}`);
    } catch (err: any) {
      error(err.message || 'Failed to create transfer session.');
    } finally {
      setIsCreating(false);
    }
  };

  // Join Existing Session
  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;

    setIsJoining(true);
    try {
      const cleanCode = joinCodeInput.trim().toUpperCase();
      const res = await api.getQuickTransfer(cleanCode);

      setActiveSession(res.room);
      setTransferredFiles(res.files || []);
      setClipboardItems(res.clipboard || []);

      const shareUrl = generateShareUrl(res.room.code);
      const qr = await QRCode.toDataURL(shareUrl, {
        width: 260,
        margin: 2
      });
      setSessionQrUrl(qr);

      success(`Connected to Quick Transfer session: ${cleanCode}`);
    } catch (err: any) {
      error(err.message || 'Session not found or expired.');
    } finally {
      setIsJoining(false);
    }
  };

  // Upload Files to Session
  const handleUploadFiles = async (files: FileList) => {
    if (!activeSession) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const uploaded = await uploadFile(file, {
          roomId: activeSession.id,
          isTemporary: true,
          expiryHours: 2
        });
        setTransferredFiles((prev) => [uploaded, ...prev]);
        success(`Transferred ${file.name}!`);
      } catch (err: any) {
        error(`Failed to transfer ${file.name}`);
      }
    }
  };

  // Share Clipboard Snippet
  const handleShareSnippet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !snippetText.trim()) return;

    try {
      const res = await api.shareClipboard(activeSession.id, snippetText.trim());
      setClipboardItems((prev) => [res.item, ...prev]);
      setSnippetText('');
      success('Snippet shared!');
    } catch (err: any) {
      error('Failed to share snippet.');
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    success('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 m-0">
              Quick Transfer
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/60 flex items-center gap-1">
              <Zap className="w-3 h-3 fill-amber-500 text-amber-500" /> Lab Mode
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Instant peer-to-peer file sharing between 2 phones or laptops with QR code scanning.
          </p>
        </div>

        {activeSession && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800">
              <Clock className="w-3.5 h-3.5" /> Auto-expires in: <strong>{timeLeft}</strong>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setActiveSession(null);
                setTransferredFiles([]);
                setClipboardItems([]);
              }}
            >
              Exit
            </Button>
          </div>
        )}
      </div>

      {!activeSession ? (
        /* Connect or Create Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Card 1: Create Quick Room */}
          <Card className="p-6 sm:p-8 flex flex-col justify-between space-y-6 border-2 border-blue-500/20 shadow-md">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Share from This Device
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Generate a temporary QR code & 6-character room code. Show your screen so another phone or PC can scan and connect instantly.
              </p>
            </div>

            <Button
              onClick={handleCreateSession}
              isLoading={isCreating}
              className="w-full py-3"
              icon={<Sparkles className="w-4 h-4" />}
            >
              Create Quick Room & Show QR
            </Button>
          </Card>

          {/* Card 2: Join Existing Room */}
          <Card className="p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-md">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Receive on This Device
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Enter the room code displayed on the other device or scan the QR code to establish connection.
              </p>
            </div>

            <form onSubmit={handleJoinSession} className="space-y-3">
              <input
                type="text"
                required
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. LAB-402 or LAB-ABC-XYZ"
                className="w-full text-center tracking-widest font-mono text-lg py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
              <Button
                type="submit"
                variant="outline"
                className="w-full py-3"
                isLoading={isJoining}
                disabled={!joinCodeInput.trim()}
              >
                Connect to Room
              </Button>
            </form>
          </Card>
        </div>
      ) : (
        /* Active Quick Transfer Interface */
        <div className="space-y-6">
          {/* QR & Code Bar */}
          <Card className="p-6 bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/50 dark:from-slate-900 dark:to-slate-800/80">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                {sessionQrUrl && (
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 shrink-0">
                    <img src={sessionQrUrl} alt="Quick Transfer QR" className="w-24 h-24" />
                  </div>
                )}
                <div>
                  <span className="text-xs text-slate-400">Connected Room Code</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-2xl sm:text-3xl font-mono font-bold text-blue-600 dark:text-blue-400 tracking-wider">
                      {activeSession.code}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activeSession.code);
                        success('Room code copied!');
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Both devices are now paired. Drop files or send text below for instant transfer.
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                icon={<UploadCloud className="w-4 h-4" />}
              >
                Send Files Now
              </Button>
            </div>
          </Card>

          {/* Drag & Drop Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-blue-400 dark:border-blue-600 bg-blue-50/30 dark:bg-blue-950/20 rounded-2xl p-6 sm:p-8 text-center cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-950/40 transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleUploadFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <UploadCloud className="w-10 h-10 text-blue-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Drag & Drop files or click to send to paired device
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Images, videos, PDFs, code, Quartus/FPGA archives. Uploaded with chunk streaming!
            </p>
          </div>

          {/* Upload Progress Queue */}
          {uploads.length > 0 && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
                <span>Transfer Progress ({uploads.length})</span>
                <button
                  onClick={clearCompleted}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Clear Finished
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {uploads.map((u) => (
                  <div
                    key={u.file.name}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate flex-1">
                        {u.file.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-400">
                          {formatSize(u.uploadedBytes)} / {formatSize(u.totalBytes)} ({u.progress}%)
                        </span>
                        {u.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {u.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-500" />}
                        {u.status === 'assembling' && (
                          <span className="text-blue-600 flex items-center gap-1 text-[11px]">
                            <Loader2 className="w-3 h-3 animate-spin" /> Finalizing...
                          </span>
                        )}
                        {u.status === 'uploading' && (
                          <button
                            onClick={() => cancelUpload(u.file.name)}
                            className="p-0.5 text-slate-400 hover:text-rose-600 rounded"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-150 ${
                          u.status === 'completed'
                            ? 'bg-emerald-500'
                            : u.status === 'error'
                            ? 'bg-rose-500'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${u.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Quick Clipboard Send Box */}
          <Card className="p-4 sm:p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
              Send Text / Clipboard Snippet
            </h3>
            <form onSubmit={handleShareSnippet} className="flex gap-2">
              <input
                type="text"
                value={snippetText}
                onChange={(e) => setSnippetText(e.target.value)}
                placeholder="Paste link, lab command, code snippet, or text to transfer instantly..."
                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button type="submit" size="sm" disabled={!snippetText.trim()} icon={<Send className="w-3.5 h-3.5" />}>
                Send
              </Button>
            </form>
          </Card>

          {/* Transferred Content Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Files List */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>Transferred Files ({transferredFiles.length})</span>
              </h3>

              {transferredFiles.length === 0 ? (
                <Card className="p-8 text-center text-slate-400 text-xs">
                  No files transferred yet in this session.
                </Card>
              ) : (
                <div className="space-y-2">
                  {transferredFiles.map((file) => (
                    <Card key={file.id} className="p-3 flex items-center justify-between gap-3 text-xs" hoverEffect>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {file.original_name}
                        </p>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          {formatSize(file.file_size)} • {file.uploader_name}
                        </p>
                      </div>

                      <a
                        href={api.getFileDownloadUrl(file.id)}
                        download={file.original_name}
                        className="shrink-0"
                      >
                        <Button size="sm" variant="secondary" icon={<Download className="w-3.5 h-3.5" />}>
                          Download
                        </Button>
                      </a>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Clipboard Snippets */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Transferred Text Snippets ({clipboardItems.length})
              </h3>

              {clipboardItems.length === 0 ? (
                <Card className="p-8 text-center text-slate-400 text-xs">
                  No text snippets transferred yet.
                </Card>
              ) : (
                <div className="space-y-2">
                  {clipboardItems.map((item) => (
                    <Card key={item.id} className="p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {item.sender_name}
                        </span>
                        <span>{new Date(item.created_at).toLocaleTimeString()}</span>
                      </div>
                      <pre className="p-2 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto whitespace-pre-wrap break-words">
                        {item.content}
                      </pre>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[11px] py-1"
                          onClick={() => handleCopyText(item.id, item.content)}
                          icon={
                            copiedId === item.id ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )
                          }
                        >
                          {copiedId === item.id ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
