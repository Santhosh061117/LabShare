import React, { useRef, useState } from 'react';
import { UploadCloud, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { UploadProgress } from '../../hooks/useFileUpload';
import { Button } from '../common/Button';

interface FileUploaderProps {
  uploads: UploadProgress[];
  onUpload: (files: FileList) => void;
  onCancel: (filename: string) => void;
  onClearCompleted?: () => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  uploads,
  onUpload,
  onCancel,
  onClearCompleted
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.01]'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-white dark:bg-slate-900/40'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onUpload(e.target.files);
              e.target.value = '';
            }
          }}
        />

        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
          <UploadCloud className="w-6 h-6" />
        </div>

        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Click to upload or drag & drop files here
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Supports Images, Videos, Audio, PDFs, ZIP, C/C++, Java, Python, Verilog & Quartus projects
        </p>
        <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-2 font-medium">
          Fast resumable chunk streaming — Large files supported without crashing Termux memory!
        </p>
      </div>

      {/* Upload Progress Queue */}
      {uploads.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">
            <span>Upload Queue ({uploads.length})</span>
            {onClearCompleted && (
              <button
                onClick={onClearCompleted}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Clear Finished
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {uploads.map((u) => (
              <div
                key={u.file.name}
                className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate flex-1">
                    {u.file.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-400">
                      {formatSize(u.uploadedBytes)} / {formatSize(u.totalBytes)}
                    </span>
                    {u.status === 'completed' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                    {u.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                    )}
                    {u.status === 'assembling' && (
                      <span className="text-blue-600 flex items-center gap-1 text-[11px]">
                        <Loader2 className="w-3 h-3 animate-spin" /> Assembling...
                      </span>
                    )}
                    {u.status === 'uploading' && (
                      <button
                        onClick={() => onCancel(u.file.name)}
                        className="p-0.5 text-slate-400 hover:text-rose-600 rounded"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      u.status === 'completed'
                        ? 'bg-emerald-500'
                        : u.status === 'error'
                        ? 'bg-rose-500'
                        : u.status === 'cancelled'
                        ? 'bg-slate-400'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${u.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
