import React, { useState, useEffect } from 'react';
import { HardDrive, Trash2, RefreshCw, FileText, CheckCircle2, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StorageStats, FileRecord } from '../types';

export const StoragePage: React.FC = () => {
  const { success, error } = useToast();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.getStorageStats();
      setStats(res.stats);
    } catch (err: any) {
      error(err.message || 'Failed to fetch storage stats.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleCleanup = async () => {
    setIsCleaning(true);
    try {
      const res = await api.runStorageCleanup();
      setStats(res.stats);
      success('Temporary and expired files cleaned up!');
    } catch (err: any) {
      error(err.message || 'Cleanup failed.');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await api.deleteFile(fileId);
      success('File deleted.');
      fetchStats();
    } catch (err: any) {
      error(err.message || 'Failed to delete file.');
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 m-0">
            Storage Manager
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor Termux local storage usage, inspect largest files, and run cleanup jobs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchStats}
            isLoading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleCleanup}
            isLoading={isCleaning}
            icon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Clean Expired Files
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <span className="text-xs text-slate-500">Total Storage Used</span>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {formatBytes(stats?.totalBytes || 0)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Stored safely on Android Termux</p>
        </Card>

        <Card className="p-5">
          <span className="text-xs text-slate-500">Total Files</span>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {stats?.fileCount || 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">Active files across all lab rooms</p>
        </Card>

        <Card className="p-5">
          <span className="text-xs text-slate-500">Auto-Cleanup Policy</span>
          <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Enabled (Every 10m)
          </p>
          <p className="text-xs text-slate-400 mt-1">Temporary quick transfers expire cleanly</p>
        </Card>
      </div>

      {/* Largest Files Table */}
      <Card className="p-5 space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
          Largest Files on Storage
        </h3>

        {!stats?.largestFiles || stats.largestFiles.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No files uploaded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {stats.largestFiles.map((file) => (
              <div
                key={file.id}
                className="py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {file.original_name}
                    </p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      {formatBytes(file.file_size)} • Uploaded by {file.uploader_name}
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteFile(file.id)}
                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5"
                  title="Delete file"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
