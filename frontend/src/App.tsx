import React, { useState, useEffect } from 'react';
import { ServerProvider } from './context/ServerContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/layout/Layout';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { RoomsPage } from './pages/RoomsPage';
import { RoomChatPage } from './pages/RoomChatPage';
import { QuickTransferPage } from './pages/QuickTransferPage';
import { FilesPage } from './pages/FilesPage';
import { DevicesPage } from './pages/DevicesPage';
import { StoragePage } from './pages/StoragePage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';

export const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [pageParams, setPageParams] = useState<any>({});

  // Sync hash routing & URL parameters for GitHub Pages
  useEffect(() => {
    const handleHashChange = () => {
      // Check query params in window.location.search and hash
      const urlParams = new URLSearchParams(window.location.search);
      const quickParam = urlParams.get('quick');
      const roomParam = urlParams.get('room');

      let hashParamString = '';
      if (window.location.hash.includes('?')) {
        hashParamString = window.location.hash.split('?')[1];
      }
      const hashParams = new URLSearchParams(hashParamString);
      const activeQuick = quickParam || hashParams.get('quick');
      const activeRoom = roomParam || hashParams.get('room');

      if (activeQuick) {
        setCurrentPage('quick-transfer');
        setPageParams({ code: activeQuick });
        return;
      }

      if (activeRoom) {
        setCurrentPage('rooms');
        setPageParams({ joinCode: activeRoom });
        return;
      }

      const cleanHash = window.location.hash.split('?')[0].replace(/^#\/?/, '');
      if (cleanHash.startsWith('room/')) {
        const roomId = cleanHash.replace('room/', '');
        setCurrentPage('room-chat');
        setPageParams({ roomId });
      } else if (cleanHash) {
        setCurrentPage(cleanHash);
      } else {
        setCurrentPage('dashboard');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (page: string, params: any = {}) => {
    setCurrentPage(page);
    setPageParams(params);

    if (page === 'room-chat' && params.roomId) {
      window.location.hash = `#/room/${params.roomId}`;
    } else if (page === 'dashboard') {
      window.location.hash = '#/';
    } else {
      window.location.hash = `#/${page}`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage onNavigate={handleNavigate} />;
      case 'rooms':
        return <RoomsPage onNavigate={handleNavigate} initialJoinCode={pageParams?.joinCode} />;
      case 'room-chat':
        return <RoomChatPage roomId={pageParams.roomId} onNavigate={handleNavigate} />;
      case 'quick-transfer':
        return <QuickTransferPage initialCode={pageParams?.code} />;
      case 'files':
        return <FilesPage roomId={pageParams.roomId} />;
      case 'devices':
        return <DevicesPage />;
      case 'storage':
        return <StoragePage />;
      case 'settings':
        return <SettingsPage />;
      case 'login':
        return <LoginPage onSuccess={() => handleNavigate('dashboard')} />;
      default:
        return <DashboardPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {renderPage()}
    </Layout>
  );
};

export default function App() {
  return (
    <ServerProvider>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ServerProvider>
  );
}
