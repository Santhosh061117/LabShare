import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { FileRecord } from '../../types';
import { api } from '../../services/api';
import { 
  Download, 
  FileCode, 
  FileText, 
  Eye, 
  Calendar, 
  HardDrive, 
  User, 
  Clock, 
  Copy, 
  Check 
} from 'lucide-react';

interface FilePreviewModalProps {
  file: FileRecord | null;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose }) => {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!file) {
      setTextContent(null);
      return;
    }

    const isCodeOrText =
      file.mime_type.startsWith('text/') ||
      file.mime_type.includes('json') ||
      file.mime_type.includes('javascript') ||
      /\.(c|cpp|h|hpp|java|py|v|sv|vhd|vhdl|qpf|qsf|txt|log|md|sh)$/i.test(file.original_name);

    if (isCodeOrText && file.file_size < 2 * 1024 * 1024) {
      setLoadingText(true);
      api.getFileText(file.id)
        .then((text) => setTextContent(typeof text === 'string' ? text : JSON.stringify(text, null, 2)))
        .catch(() => setTextContent('Unable to preview text content.'))
        .finally(() => setLoadingText(false));
    } else {
      setTextContent(null);
    }
  }, [file]);

  if (!file) return null;

  const downloadUrl = api.getFileDownloadUrl(file.id);
  const viewUrl = api.getFileViewUrl(file.id);

  const isImage = file.mime_type.startsWith('image/');
  const isVideo = file.mime_type.startsWith('video/');
  const isAudio = file.mime_type.startsWith('audio/');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(downloadUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <Modal isOpen={!!file} onClose={onClose} title={file.original_name} maxWidth="xl">
      <div className="space-y-4">
        {/* Preview Container */}
        <div className="rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 flex items-center justify-center min-h-[220px] max-h-[480px] border border-slate-200 dark:border-slate-800">
          {isImage ? (
            <img
              src={viewUrl}
              alt={file.original_name}
              className="max-h-[440px] w-auto max-w-full object-contain p-2"
            />
          ) : isVideo ? (
            <video
              src={viewUrl}
              controls
              className="max-h-[440px] w-full bg-black rounded-xl"
              preload="metadata"
            >
              Your browser does not support HTML5 video streaming.
            </video>
          ) : isAudio ? (
            <div className="p-6 w-full flex flex-col items-center">
              <audio src={viewUrl} controls className="w-full max-w-md">
                Your browser does not support audio playback.
              </audio>
            </div>
          ) : textContent !== null ? (
            <div className="w-full h-full max-h-[440px] overflow-auto p-4 text-xs font-mono bg-slate-900 text-slate-100 whitespace-pre">
              {loadingText ? 'Loading code preview...' : textContent}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-slate-400" />
              <p className="text-sm font-medium">No inline preview available</p>
              <p className="text-xs text-slate-400 mt-1">
                Please download the file to inspect its contents.
              </p>
            </div>
          )}
        </div>

        {/* Metadata Details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5" /> File Size
            </span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
              {formatSize(file.file_size)}
            </p>
          </div>

          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Uploader
            </span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
              {file.uploader_name}
            </p>
          </div>

          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Uploaded
            </span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
              {new Date(file.created_at).toLocaleDateString()}
            </p>
          </div>

          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> Downloads
            </span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
              {file.download_count} times
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            icon={copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          >
            {copiedLink ? 'Link Copied!' : 'Copy Direct Link'}
          </Button>

          <a href={downloadUrl} download={file.original_name}>
            <Button size="sm" icon={<Download className="w-3.5 h-3.5" />}>
              Download File
            </Button>
          </a>
        </div>
      </div>
    </Modal>
  );
};
