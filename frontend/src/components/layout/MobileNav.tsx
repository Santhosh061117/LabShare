import React from 'react';
import { LayoutDashboard, MessagesSquare, Zap, FolderArchive, Laptop2 } from 'lucide-react';

interface MobileNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentPage, onNavigate }) => {
  const items = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'rooms', label: 'Rooms', icon: MessagesSquare },
    { id: 'quick-transfer', label: 'Transfer', icon: Zap, isCenter: true },
    { id: 'files', label: 'Files', icon: FolderArchive },
    { id: 'devices', label: 'Devices', icon: Laptop2 },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-3 py-1.5 flex items-center justify-around safe-area-pb">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentPage === item.id || (item.id === 'rooms' && currentPage === 'room-chat');

        if (item.isCenter) {
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="flex flex-col items-center -mt-5"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-transform border-4 border-white dark:border-slate-900">
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mt-1">
                Quick
              </span>
            </button>
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center py-1 px-2.5 rounded-lg transition-colors ${
              isActive
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
