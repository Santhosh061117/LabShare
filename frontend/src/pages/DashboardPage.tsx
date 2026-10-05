import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MessagesSquare, 
  HardDrive, 
  FileText, 
  Zap, 
  PlusCircle, 
  KeyRound, 
  Laptop2, 
  Activity, 
  Clock, 
  Cpu, 
  ChevronRight,
  FolderArchive,
  ArrowUpRight
} from 'lucide-react';
import { useServer } from '../context/ServerContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Room } from '../types';
import { CreateRoomModal } from '../components/rooms/CreateRoomModal';
import { JoinRoomModal } from '../components/rooms/JoinRoomModal';
import { QRPairingModal } from '../components/devices/QRPairingModal';

interface DashboardPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { isOnline, pingMs, health, checking } = useServer();
  const { user, isAuthenticated } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    if (isOnline) {
      api.getRooms()
        .then((res) => setRooms(res.rooms || []))
        .catch(() => {});
    }
  }, [isOnline]);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-700 text-white p-6 sm:p-8 shadow-xl shadow-blue-500/10">
        <div className="relative z-10 max-w-2xl space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md">
            College & Lab Sharing Platform
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white m-0">
            {isAuthenticated ? `Welcome back, ${user?.displayName}!` : 'Welcome to LabShare'}
          </h1>
          <p className="text-sm sm:text-base text-blue-100/90 max-w-xl">
            High-speed real-time messaging, code snippet syncing, and large file transfers hosted locally on Android Termux.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-3">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white text-blue-700 hover:bg-blue-50 border-0 font-semibold shadow"
              onClick={() => onNavigate('quick-transfer')}
              icon={<Zap className="w-4 h-4 text-amber-500 fill-amber-500" />}
            >
              Quick Transfer
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-blue-700/60 hover:bg-blue-700 text-white border-0"
              onClick={() => setShowCreateRoom(true)}
              icon={<PlusCircle className="w-4 h-4" />}
            >
              Create Lab Room
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-blue-700/60 hover:bg-blue-700 text-white border-0"
              onClick={() => setShowJoinRoom(true)}
              icon={<KeyRound className="w-4 h-4" />}
            >
              Join Room
            </Button>
            {!isAuthenticated && (
              <Button
                size="sm"
                variant="secondary"
                className="bg-blue-700/60 hover:bg-blue-700 text-white border-0"
                onClick={() => setShowQrModal(true)}
                icon={<Laptop2 className="w-4 h-4" />}
              >
                Pair via QR
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Status Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Backend & Tunnel Status */}
        <Card className="p-4" hoverEffect>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Termux Backend
            </span>
            <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {isOnline ? 'Active Online' : 'Offline'}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
            <Activity className="w-3.5 h-3.5" />
            <span>{pingMs !== null ? `${pingMs}ms latency` : 'Server stopped'}</span>
          </div>
        </Card>

        {/* Connected Clients */}
        <Card className="p-4" hoverEffect>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Connected Clients
            </span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {health?.metrics.connectedClients || 0}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
            <Cpu className="w-3.5 h-3.5" />
            <span>Active WebSockets</span>
          </div>
        </Card>

        {/* Active Lab Rooms */}
        <Card className="p-4" hoverEffect>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Active Rooms
            </span>
            <MessagesSquare className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {health?.metrics.activeRooms || 0}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Uptime: {formatUptime(health?.uptimeSeconds || 0)}</span>
          </div>
        </Card>

        {/* Storage Used */}
        <Card className="p-4" hoverEffect>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Storage Footprint
            </span>
            <HardDrive className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {formatBytes(health?.metrics.storageUsedBytes || 0)}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
            <FileText className="w-3.5 h-3.5" />
            <span>{health?.metrics.totalFiles || 0} files stored</span>
          </div>
        </Card>
      </div>

      {/* Quick Action Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Quick Transfer Tile */}
        <Card
          onClick={() => onNavigate('quick-transfer')}
          className="p-5 cursor-pointer group border-l-4 border-l-amber-500"
          hoverEffect
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Zap className="w-5 h-5 fill-amber-500" />
          </div>
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center justify-between">
            <span>Quick Transfer</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Scan QR code or enter code between 2 phones/laptops for instant peer transfer. Temporary files auto-delete.
          </p>
        </Card>

        {/* Lab Rooms Tile */}
        <Card
          onClick={() => onNavigate('rooms')}
          className="p-5 cursor-pointer group border-l-4 border-l-blue-600"
          hoverEffect
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <MessagesSquare className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center justify-between">
            <span>Lab Rooms & Chat</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Collaborative rooms with real-time chat, replies, reactions, code snippet clipboard, and file downloads.
          </p>
        </Card>

        {/* Files & Media Tile */}
        <Card
          onClick={() => onNavigate('files')}
          className="p-5 cursor-pointer group border-l-4 border-l-purple-600"
          hoverEffect
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <FolderArchive className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center justify-between">
            <span>Files & Streaming</span>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Upload large ZIPs, FPGA/Quartus projects, C/Python code with chunk streaming, video seek, and preview.
          </p>
        </Card>
      </div>

      {/* Active Lab Rooms Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 m-0">
            Active Lab Rooms
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigate('rooms')}
            icon={<ChevronRight className="w-4 h-4" />}
          >
            View All
          </Button>
        </div>

        {rooms.length === 0 ? (
          <Card className="p-8 text-center text-slate-400">
            <MessagesSquare className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No active lab rooms yet</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Create a room for your lab class or join an existing session with a code.
            </p>
            <div className="flex justify-center gap-2 mt-4">
              <Button size="sm" onClick={() => setShowCreateRoom(true)}>
                Create Room
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowJoinRoom(true)}>
                Join with Code
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rooms.slice(0, 4).map((r) => (
              <Card
                key={r.id}
                onClick={() => onNavigate('room-chat', { roomId: r.id })}
                className="p-4 cursor-pointer group"
                hoverEffect
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                      {r.code}
                    </span>
                    {r.is_temporary === 1 && (
                      <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                        Temp
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {r.member_count || 0}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 mt-2 truncate group-hover:text-blue-600 transition-colors">
                  {r.name}
                </h4>
                {r.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {r.description}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateRoomModal
        isOpen={showCreateRoom}
        onClose={() => setShowCreateRoom(false)}
        onRoomCreated={(r) => onNavigate('room-chat', { roomId: r.id })}
      />
      <JoinRoomModal
        isOpen={showJoinRoom}
        onClose={() => setShowJoinRoom(false)}
        onRoomJoined={(r) => onNavigate('room-chat', { roomId: r.id })}
      />
      <QRPairingModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
      />
    </div>
  );
};
