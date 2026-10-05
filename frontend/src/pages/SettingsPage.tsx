import React, { useState } from 'react';
import { 
  Globe, 
  Moon, 
  Sun, 
  Laptop, 
  Download, 
  Trash2, 
  CheckCircle2, 
  RefreshCw, 
  AlertTriangle, 
  ShieldAlert 
} from 'lucide-react';
import { useServer } from '../context/ServerContext';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';

export const SettingsPage: React.FC = () => {
  const { backendUrl, changeBackendUrl, isOnline, pingMs } = useServer();
  const { theme, setTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const { success, error } = useToast();

  const [urlInput, setUrlInput] = useState(backendUrl);
  const [testingUrl, setTestingUrl] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingUrl(true);
    const ok = await changeBackendUrl(urlInput.trim());
    setTestingUrl(false);

    if (ok) {
      success('Connected to backend server!');
    } else {
      error('Failed to connect to backend URL.');
    }
  };

  const handleExportData = () => {
    window.open(api.exportDataUrl(), '_blank');
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you absolutely sure you want to permanently delete your account and all uploaded files? This action is irreversible.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteAccount();
      success('Your account and files were permanently deleted.');
      logout();
    } catch (err: any) {
      error(err.message || 'Failed to delete account.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 m-0">
          Settings & Configuration
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Customize backend connection, appearance, and privacy data.
        </p>
      </div>

      {/* Backend Connection Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Backend Server URL
            </h3>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              isOnline
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
            }`}
          >
            {isOnline ? `Online (${pingMs}ms)` : 'Offline'}
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Point the frontend to your stable Cloudflare Named Tunnel (e.g. <code>https://lab.yourdomain.com</code>) or local Wi-Fi IP address.
        </p>

        <form onSubmit={handleSaveUrl} className="space-y-3">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="http://localhost:3000 or https://lab.yourdomain.com"
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setUrlInput('http://localhost:3000')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Reset to Localhost (3000)
            </button>

            <Button type="submit" size="sm" isLoading={testingUrl} icon={<RefreshCw className="w-3.5 h-3.5" />}>
              Test & Connect
            </Button>
          </div>
        </form>
      </Card>

      {/* Appearance Card */}
      <Card className="p-6 space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
          Theme & Appearance
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`p-3.5 rounded-2xl border text-center transition-all ${
              theme === 'light'
                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <Sun className="w-5 h-5 mx-auto mb-1 text-amber-500" />
            <span className="text-xs">Light</span>
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={`p-3.5 rounded-2xl border text-center transition-all ${
              theme === 'dark'
                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <Moon className="w-5 h-5 mx-auto mb-1 text-indigo-400" />
            <span className="text-xs">Dark</span>
          </button>

          <button
            onClick={() => setTheme('system')}
            className={`p-3.5 rounded-2xl border text-center transition-all ${
              theme === 'system'
                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <Laptop className="w-5 h-5 mx-auto mb-1 text-slate-500" />
            <span className="text-xs">System</span>
          </button>
        </div>
      </Card>

      {/* Privacy & Account */}
      {isAuthenticated && (
        <Card className="p-6 space-y-4 border-rose-200/50 dark:border-rose-900/30">
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" /> Data Privacy & Account
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            All your data, messages, and uploaded files reside on the Termux Android device. No external telemetry or cloud tracking is collected.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportData}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Export All My Data (JSON)
            </Button>

            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteAccount}
              isLoading={isDeleting}
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Delete My Account & Files
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
