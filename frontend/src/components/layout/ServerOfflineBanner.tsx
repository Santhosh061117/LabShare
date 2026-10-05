import React, { useState } from 'react';
import { useServer } from '../../context/ServerContext';
import { ServerSettingsModal } from './ServerSettingsModal';
import { AlertTriangle, Settings, RefreshCw, Terminal } from 'lucide-react';
import { Button } from '../common/Button';

export const ServerOfflineBanner: React.FC = () => {
  const { isOnline, checking, checkHealthNow } = useServer();
  const [showSettings, setShowSettings] = useState(false);

  if (isOnline) return null;

  return (
    <>
      <div className="bg-rose-500 text-white px-4 py-2.5 shadow-md border-b border-rose-600 transition-all duration-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2.5 font-medium">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-200 animate-bounce" />
            <div>
              <span>
                <strong>Termux server is offline.</strong> Start LabShare in Termux.
              </span>
              <span className="hidden lg:inline text-rose-100 text-xs ml-2">
                (On another device or phone? Set your Cloudflare HTTPS Tunnel in <strong>Server URL</strong>)
              </span>
            </div>
            <span className="hidden md:inline-block text-rose-100 text-xs bg-rose-700/60 px-2 py-0.5 rounded font-mono shrink-0">
              ./start.sh
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs py-1"
              isLoading={checking}
              onClick={() => checkHealthNow()}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Retry
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-white text-rose-700 hover:bg-rose-50 text-xs py-1 font-semibold"
              onClick={() => setShowSettings(true)}
              icon={<Settings className="w-3.5 h-3.5" />}
            >
              Server URL
            </Button>
          </div>
        </div>
      </div>

      <ServerSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
};
