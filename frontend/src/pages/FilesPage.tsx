import React, { useState, useEffect } from 'react';
import { FolderArchive, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFileUpload } from '../hooks/useFileUpload';
import { FileRecord } from '../types';
import { FileUploader } from '../components/files/FileUploader';
import { FileList } from '../components/files/FileList';
import { FilePreviewModal } from '../components/files/FilePreviewModal';
import { Button } from '../components/common/Button';

interface FilesPageProps {
  roomId?: string;
}

export const FilesPage: React.FC<FilesPageProps> = ({ roomId }) => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const { uploadFile, uploads, cancelUpload, clearCompleted } = useFileUpload();

  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      if (roomId) {
        const res = await api.getRoomFiles(roomId);
        setFiles(res.files || []);
      } else {
        const res = await api.getStorageStats();
        setFiles(res.stats.largestFiles || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [roomId]);

  const handleUpload = async (fileList: FileList) => {
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      try {
        const uploaded = await uploadFile(f, { roomId: roomId || null });
        setFiles((prev) => [uploaded, ...prev]);
        success(`Uploaded ${f.name}!`);
      } catch (err: any) {
        error(`Failed to upload ${f.name}`);
      }
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      await api.deleteFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      success('File deleted.');
    } catch (err: any) {
      error(err.message || 'Failed to delete file.');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 m-0">
              Files & Media Storage
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold">
              {files.length} files
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Stream high-definition media, preview code files, and download course assets stored on the secure gateway.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={fetchFiles}
          isLoading={loading}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {/* Uploader Box */}
      <FileUploader
        uploads={uploads}
        onUpload={handleUpload}
        onCancel={cancelUpload}
        onClearCompleted={clearCompleted}
      />

      {/* File List */}
      <FileList
        files={files}
        onPreview={(file) => setPreviewFile(file)}
        onDelete={handleDelete}
        currentUserId={user?.id}
      />

      {/* Preview Modal */}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
};
