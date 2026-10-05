import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useServer } from '../../context/ServerContext';
import { useToast } from '../../context/ToastContext';
import { Globe, RefreshCw, CheckCircle2, AlertCircle, QrCode, Copy, Check, AlertTriangle } from 'lucide-react';

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({ isOpen, onClose }) => {
  const { backendUrl, changeBackendUrl, isOnline, pingMs } = useServer();
  const { success, error } = useToast();
  const [urlInput, setUrlInput] = useState(backendUrl);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showShareQr, setShowShareQr] = useState(false);
  const [shareQrDataUrl, setShareQrDataUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync urlInput when backendUrl changes
  useEffect(() => {
    setUrlInput(backendUrl);
  }, [backendUrl]);

  // Generate Connect QR code
  useEffect(() => {
    if (showShareQr && typeof window !== 'undefined') {
      const shareUrl = `${window.location.origin}${window.location.pathname}?server=${encodeURIComponent(backendUrl)}`;
      QRCode.toDataURL(shareUrl, { width: 220, margin: 2 })
        .then((url) => setShareQrDataUrl(url))
        .catch(() => {});
    }
  }, [showShareQr, backendUrl]);

  const isHttpsFrontend = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const isHttpBackend = urlInput.trim().toLowerCase().startsWith('http://') &&
    !urlInput.trim().toLowerCase().startsWith('http://localhost') &&
    !urlInput.trim().toLowerCase().startsWith('http://127.0.0.1');

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      error('Backend URL cannot be empty');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const ok = await changeBackendUrl(urlInput.trim());
    setIsTesting(false);

    if (ok) {
      setTestResult({ success: true, message: 'Successfully connected to Termux backend!' });
      success('Connected to backend server!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } else {
      setTestResult({
        success: false,
        message: 'Could not reach server at this URL. Make sure Termux ./start.sh is running.'
      });
      error('Failed to connect to specified backend.');
    }
  };

  const handleCopyShareLink = () => {
    if (typeof window === 'undefined') return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?server=${encodeURIComponent(backendUrl)}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    success('Shareable connect link copied!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Backend Server Connection">
      <form onSubmit={handleTestAndSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Backend API / Cloudflare Named Tunnel URL
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Globe className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="e.g. https://lab.yourdomain.com or http://localhost:3000"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* Mixed Content Warning */}
          {isHttpsFrontend && isHttpBackend && (
            <div className="mt-2.5 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">Mixed Content Warning:</p>
                <p>
                  You are viewing LabShare over <strong>HTTPS</strong>. Browsers block insecure <code>http://</code> URLs. For mobile phones and other devices, use your Cloudflare <strong>HTTPS Named Tunnel</strong> (e.g. <code>https://lab.yourdomain.com</code>).
                </p>
              </div>
            </div>
          )}

          <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              💡 Connecting from another device (Phone / Laptop)?
            </p>
            <p>
              • <code>localhost</code> only points to the host device itself.
            </p>
            <p>
              • For other devices, enter your Cloudflare HTTPS Tunnel URL (e.g. <code>https://lab.yourdomain.com</code>).
            </p>
          </div>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-xl text-xs flex items-start gap-2.5 border ${
              testResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{testResult.message}</p>
              {testResult.success && pingMs && (
                <p className="text-[11px] opacity-80 mt-0.5">Latency: {pingMs}ms</p>
              )}
            </div>
          </div>
        )}

        {/* Share with Other Devices Section */}
        {isOnline && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowShareQr(!showShareQr)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 font-medium"
            >
              <QrCode className="w-3.5 h-3.5" />
              {showShareQr ? 'Hide Server Connect QR' : 'Show Connect QR / Link for Other Phones'}
            </button>

            {showShareQr && (
              <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-center space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Scan this QR code with any phone camera to instantly connect that phone to your Termux backend:
                </p>
                {shareQrDataUrl && (
                  <div className="inline-block p-3 bg-white rounded-xl shadow-sm border border-slate-200">
                    <img src={shareQrDataUrl} alt="Connect QR" className="w-44 h-44 mx-auto" />
                  </div>
                )}
                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCopyShareLink}
                    icon={copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedLink ? 'Link Copied!' : 'Copy Shareable Connect Link'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setUrlInput('http://localhost:3000')}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Reset to Localhost (3000)
          </button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isTesting} icon={<RefreshCw className="w-3.5 h-3.5" />}>
              Connect & Save
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
