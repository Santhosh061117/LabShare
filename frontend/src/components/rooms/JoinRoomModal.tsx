import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { KeyRound, Lock, User as UserIcon, LogIn } from 'lucide-react';
import { Room } from '../../types';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomJoined: (room: Room) => void;
  initialCode?: string;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  onClose,
  onRoomJoined,
  initialCode = ''
}) => {
  const { user, isAuthenticated } = useAuth();
  const { success, error } = useToast();
  const [code, setCode] = useState(initialCode);
  const [password, setPassword] = useState('');
  const [guestName, setGuestName] = useState(() => localStorage.getItem('labshare_guest_name') || '');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      error('Please enter a room code');
      return;
    }

    if (!isAuthenticated && !guestName.trim()) {
      error('Please enter your name as a guest');
      return;
    }

    if (!isAuthenticated && guestName.trim()) {
      localStorage.setItem('labshare_guest_name', guestName.trim());
    }

    setIsLoading(true);
    try {
      const res = await api.joinRoom({
        code: code.trim(),
        password: password.trim() || undefined,
        guestName: !isAuthenticated ? guestName.trim() : undefined
      });

      success(`Joined lab room "${res.room.name}"!`);
      onRoomJoined(res.room);
      onClose();
      setCode('');
      setPassword('');
      setRequiresPassword(false);
    } catch (err: any) {
      if (err.message?.includes('password is required')) {
        setRequiresPassword(true);
      }
      error(err.message || 'Failed to join room');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Join Lab Room">
      <form onSubmit={handleJoin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Room Code *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. LAB-ABC-XYZ"
              className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {!isAuthenticated && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Your Name (Guest) *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. Student 21BCSE042"
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {(requiresPassword || password.length > 0) && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Room Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter room password"
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            isLoading={isLoading}
            icon={<LogIn className="w-4 h-4" />}
          >
            Join Room
          </Button>
        </div>
      </form>
    </Modal>
  );
};
