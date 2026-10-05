import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Users, Lock, Clock, PlusCircle } from 'lucide-react';
import { Room } from '../../types';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (room: Room) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onRoomCreated
}) => {
  const { success, error } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [maxMembers, setMaxMembers] = useState(50);
  const [isTemporary, setIsTemporary] = useState(false);
  const [expiryHours, setExpiryHours] = useState(4);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      error('Room name is required.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.createRoom({
        name: name.trim(),
        description: description.trim() || undefined,
        password: password.trim() || undefined,
        maxMembers,
        isTemporary,
        expiryHours: isTemporary ? expiryHours : undefined
      });

      success(`Lab room "${res.room.name}" created! Code: ${res.room.code}`);
      onRoomCreated(res.room);
      onClose();
      // Reset form
      setName('');
      setDescription('');
      setPassword('');
      setIsTemporary(false);
    } catch (err: any) {
      error(err.message || 'Failed to create room.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Lab Room">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Room Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Digital Logic Lab (Group B)"
            className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Description (Optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Verilog code sharing & lab assignment discussion"
            className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Room Password (Optional)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave empty for public lab room"
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Max Members
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Users className="w-4 h-4" />
              </div>
              <input
                type="number"
                min="2"
                max="200"
                value={maxMembers}
                onChange={(e) => setMaxMembers(parseInt(e.target.value, 10) || 50)}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Temporary Room
            </label>
            <div className="flex items-center h-10 gap-2">
              <input
                type="checkbox"
                id="isTemp"
                checked={isTemporary}
                onChange={(e) => setIsTemporary(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <label htmlFor="isTemp" className="text-xs text-slate-600 dark:text-slate-400">
                Auto-delete after lab
              </label>
            </div>
          </div>
        </div>

        {isTemporary && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/80">
            <label className="block text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">
              Expiration Duration (Hours)
            </label>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <input
                type="number"
                min="1"
                max="24"
                value={expiryHours}
                onChange={(e) => setExpiryHours(parseInt(e.target.value, 10) || 4)}
                className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-xs"
              />
              <span className="text-xs text-amber-700 dark:text-amber-300">
                Files and room automatically cleaned up
              </span>
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
            icon={<PlusCircle className="w-4 h-4" />}
          >
            Create Room
          </Button>
        </div>
      </form>
    </Modal>
  );
};
