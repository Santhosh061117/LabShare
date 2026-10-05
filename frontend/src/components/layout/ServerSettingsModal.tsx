import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useServer } from '../../context/ServerContext';
import { useToast } from '../../context/ToastContext';
import { Globe, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

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
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            For college labs: Set this to your stable Cloudflare Named Tunnel URL or local Wi-Fi IP address.
          </p>
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
