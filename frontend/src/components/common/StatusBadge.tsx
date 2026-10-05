import React from 'react';

export const LoadingSkeleton: React.FC<{
  className?: string;
  count?: number;
}> = ({ className = 'h-4 w-full', count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg ${className}`}
        />
      ))}
    </>
  );
};

export const StatusBadge: React.FC<{
  isOnline: boolean;
  pingMs?: number | null;
  checking?: boolean;
}> = ({ isOnline, pingMs, checking }) => {
  if (checking) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
        Checking...
      </span>
    );
  }

  if (isOnline) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Gateway Online {pingMs ? `(${pingMs}ms)` : ''}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
      <span className="w-2 h-2 rounded-full bg-rose-500" />
      Gateway Offline
    </span>
  );
};
