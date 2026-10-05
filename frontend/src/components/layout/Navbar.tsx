import React, { useState } from 'react';
import { Share2, Settings, Download, LogIn, User, ShieldCheck } from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useAuth } from '../../context/AuthContext';
import { usePWA } from '../../hooks/usePWA';
import { StatusBadge } from '../common/StatusBadge';
import { ThemeToggle } from '../common/ThemeToggle';
import { Button } from '../common/Button';
import { ServerSettingsModal } from './ServerSettingsModal';

interface NavbarProps {
  onNavigate: (page: string) => void;
  currentPage: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate, currentPage }) => {
  const { isOnline, pingMs, checking } = useServer();
  const { user, isAuthenticated, isTrusted } = useAuth();
  const { isInstallable, promptInstall } = usePWA();
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                LabShare
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80">
                Termux
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Self-Hosted Lab File Sharing
            </p>
          </div>
        </div>

        {/* Right Section Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Server Status Badge */}
          <div
            onClick={() => setShowSettingsModal(true)}
            className="cursor-pointer"
            title="Click to configure backend URL"
          >
            <StatusBadge isOnline={isOnline} pingMs={pingMs} checking={checking} />
          </div>

          {/* PWA Install Button */}
          {isInstallable && (
            <Button
              size="sm"
              variant="outline"
              onClick={promptInstall}
              className="hidden sm:inline-flex"
              icon={<Download className="w-3.5 h-3.5 text-blue-600" />}
            >
              Install App
            </Button>
          )}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Server Settings Cog */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Backend Server Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Auth State Button */}
          {isAuthenticated && user ? (
            <button
              onClick={() => onNavigate('devices')}
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Trusted Devices & Profile"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-xs">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-left text-xs">
                <p className="font-semibold text-slate-900 dark:text-slate-100 leading-none">
                  {user.displayName}
                </p>
                {isTrusted && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3 h-3" /> Trusted Device
                  </p>
                )}
              </div>
            </button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onNavigate('login')}
              icon={<LogIn className="w-4 h-4" />}
            >
              Sign In
            </Button>
          )}
        </div>
      </div>

      <ServerSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </header>
  );
};
