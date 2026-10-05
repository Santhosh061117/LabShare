import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { RoomMember } from '../../types';
import { Shield, UserX, Crown } from 'lucide-react';

interface MemberListDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  members: RoomMember[];
  isOwner: boolean;
  onKickMember: (userId: string) => void;
  maxMembers?: number;
}

export const MemberListDrawer: React.FC<MemberListDrawerProps> = ({
  isOpen,
  onClose,
  members,
  isOwner,
  onKickMember,
  maxMembers = 50
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Room Members (${members.length}/${maxMembers})`}
      maxWidth="md"
    >
      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
        {members.map((member) => (
          <div
            key={member.userId}
            className="py-3 flex items-center justify-between gap-3 text-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-xs">
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {member.name}
                  </span>
                  {member.role === 'owner' && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/60">
                      <Crown className="w-2.5 h-2.5" /> Owner
                    </span>
                  )}
                  {member.role === 'guest' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                      Guest
                    </span>
                  )}
                </div>
                {member.username && (
                  <p className="text-xs text-slate-400">@{member.username}</p>
                )}
              </div>
            </div>

            {isOwner && member.role !== 'owner' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onKickMember(member.userId)}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 h-auto text-xs"
                title="Remove member"
              >
                <UserX className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
};
