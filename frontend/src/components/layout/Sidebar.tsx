import React from 'react';
import { 
  LayoutDashboard, 
  MessagesSquare, 
  Zap, 
  FolderArchive, 
  Laptop2, 
  HardDrive, 
  Settings as SettingsIcon 
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'rooms', label: 'Lab Rooms', icon: MessagesSquare },
    { id: 'quick-transfer', label: 'Quick Transfer', icon: Zap, badge: 'Fast' },
    { id: 'files', label: 'Files & Media', icon: FolderArchive },
    { id: 'devices', label: 'Devices & QR', icon: Laptop2 },
    { id: 'storage', label: 'Storage Manager', icon: HardDrive },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 min-h-[calc(100vh-4rem)]">
      <div className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id || (item.id === 'rooms' && currentPage === 'room-chat');

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    isActive
                      ? 'bg-blue-500 text-white'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/40'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Files Sync Gateway Card */}
      <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs">
          <p className="font-semibold text-slate-800 dark:text-slate-200">Files Sync Gateway</p>
          <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
            High-Performance Local Storage + Secure HTTPS Gateway
          </p>
        </div>
      </div>
    </aside>
  );
};
