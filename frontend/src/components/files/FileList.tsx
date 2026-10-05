import React, { useState } from 'react';
import { FileRecord } from '../../types';
import { api } from '../../services/api';
import { 
  FileText, 
  FileCode, 
  FileImage, 
  FileVideo, 
  FileAudio, 
  FileArchive, 
  Download, 
  Eye, 
  Trash2, 
  Search, 
  Clock 
} from 'lucide-react';

interface FileListProps {
  files: FileRecord[];
  onPreview: (file: FileRecord) => void;
  onDelete?: (fileId: string) => void;
  currentUserId?: string;
  isRoomOwner?: boolean;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  onPreview,
  onDelete,
  currentUserId,
  isRoomOwner
}) => {
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'doc' | 'code'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const getFileIcon = (file: FileRecord) => {
    const mime = file.mime_type.toLowerCase();
    const name = file.original_name.toLowerCase();

    if (mime.startsWith('image/')) return <FileImage className="w-5 h-5 text-indigo-500" />;
    if (mime.startsWith('video/')) return <FileVideo className="w-5 h-5 text-rose-500" />;
    if (mime.startsWith('audio/')) return <FileAudio className="w-5 h-5 text-amber-500" />;
    if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar') || mime.includes('7z')) {
      return <FileArchive className="w-5 h-5 text-purple-500" />;
    }
    if (
      /\.(c|cpp|h|hpp|java|py|v|sv|vhd|vhdl|qpf|qsf|js|ts|html|css)$/i.test(name) ||
      mime.includes('javascript') ||
      mime.includes('typescript')
    ) {
      return <FileCode className="w-5 h-5 text-emerald-500" />;
    }
    return <FileText className="w-5 h-5 text-blue-500" />;
  };

  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.original_name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterType === 'image') return f.mime_type.startsWith('image/');
    if (filterType === 'video') return f.mime_type.startsWith('video/');
    if (filterType === 'code') {
      return /\.(c|cpp|h|hpp|java|py|v|sv|vhd|vhdl|qpf|qsf|js|ts)$/i.test(f.original_name);
    }
    if (filterType === 'doc') {
      return (
        f.mime_type.includes('pdf') ||
        f.mime_type.includes('document') ||
        f.mime_type.includes('sheet') ||
        f.mime_type.includes('presentation') ||
        /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt)$/i.test(f.original_name)
      );
    }
    return true;
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files by name..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'image', 'video', 'doc', 'code'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize shrink-0 transition-colors ${
                filterType === t
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {t === 'code' ? 'Code & FPGA' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Files Grid / List */}
      {filteredFiles.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <FileText className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No files found</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {searchQuery ? 'Try changing your search term.' : 'Upload files using the box above.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredFiles.map((file) => {
            const canDelete =
              onDelete && (isRoomOwner || (currentUserId && file.uploader_id === currentUserId));

            return (
              <div
                key={file.id}
                className="flex items-center justify-between gap-3 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm group"
              >
                <div
                  onClick={() => onPreview(file)}
                  className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center shrink-0">
                    {getFileIcon(file)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {file.original_name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>{formatSize(file.file_size)}</span>
                      <span>•</span>
                      <span className="truncate">{file.uploader_name}</span>
                      {file.is_temporary === 1 && (
                        <>
                          <span>•</span>
                          <span className="text-amber-500 font-medium flex items-center gap-0.5">
                            <Clock className="w-3 h-3" /> Temp
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onPreview(file)}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Preview file"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <a
                    href={api.getFileDownloadUrl(file.id)}
                    download={file.original_name}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Download file"
                  >
                    <Download className="w-4 h-4" />
                  </a>

                  {canDelete && (
                    <button
                      onClick={() => onDelete(file.id)}
                      className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Delete file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
