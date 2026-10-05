import React, { useState, useEffect } from 'react';
import { 
  MessagesSquare, 
  PlusCircle, 
  KeyRound, 
  Search, 
  Users, 
  Lock, 
  Clock, 
  Copy, 
  Check, 
  Crown, 
  ArrowRight 
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Room } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { CreateRoomModal } from '../components/rooms/CreateRoomModal';
import { JoinRoomModal } from '../components/rooms/JoinRoomModal';

interface RoomsPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const RoomsPage: React.FC<RoomsPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { success } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await api.getRooms();
      setRooms(res.rooms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCopyCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    success(`Copied room code: ${code}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filtered = rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 m-0">
            Lab Rooms
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Join or create temporary and collaborative lab class rooms
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowJoin(true)}
            icon={<KeyRound className="w-4 h-4" />}
          >
            Join with Code
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            icon={<PlusCircle className="w-4 h-4" />}
          >
            Create Room
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search rooms by name or code (e.g. LAB-402)..."
          className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Rooms Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-5 space-y-3">
              <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3 animate-pulse" />
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2 animate-pulse" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <MessagesSquare className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
            No lab rooms match your query
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Create a new room or check the room code.
          </p>
          <div className="flex justify-center gap-2 mt-4">
            <Button size="sm" onClick={() => setShowCreate(true)}>
              Create Room
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((room) => {
            const isOwner = user && room.owner_id === user.id;

            return (
              <Card
                key={room.id}
                onClick={() => onNavigate('room-chat', { roomId: room.id })}
                className="p-5 flex flex-col justify-between cursor-pointer group"
                hoverEffect
              >
                <div>
                  {/* Badges Bar */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                        {room.code}
                      </span>
                      <button
                        onClick={(e) => handleCopyCode(e, room.code)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                        title="Copy Room Code"
                      >
                        {copiedCode === room.code ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs">
                      {room.is_password_protected === 1 && (
                        <span title="Password Protected">
                          <Lock className="w-3.5 h-3.5 text-amber-500" />
                        </span>
                      )}
                      {room.is_temporary === 1 && (
                        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Clock className="w-3 h-3" /> Temp
                        </span>
                      )}
                      {isOwner && (
                        <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Crown className="w-3 h-3" /> Owner
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {room.name}
                  </h3>
                  {room.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {room.description}
                    </p>
                  )}
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {room.member_count || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessagesSquare className="w-3.5 h-3.5" /> {room.message_count || 0}
                    </span>
                  </div>

                  <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Enter <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreateRoomModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onRoomCreated={(r) => {
          fetchRooms();
          onNavigate('room-chat', { roomId: r.id });
        }}
      />
      <JoinRoomModal
        isOpen={showJoin}
        onClose={() => setShowJoin(false)}
        onRoomJoined={(r) => {
          fetchRooms();
          onNavigate('room-chat', { roomId: r.id });
        }}
      />
    </div>
  );
};
