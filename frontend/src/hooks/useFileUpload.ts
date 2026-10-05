import { useState, useRef } from 'react';
import { api } from '../services/api';
import { FileRecord } from '../types';

export interface UploadProgress {
  file: File;
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  status: 'pending' | 'uploading' | 'assembling' | 'completed' | 'error' | 'cancelled';
  error?: string;
  result?: FileRecord;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

export function useFileUpload() {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const cancelUpload = (filename: string) => {
    const controller = abortControllers.current.get(filename);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(filename);
    }
    setUploads((prev) =>
      prev.map((u) => (u.file.name === filename ? { ...u, status: 'cancelled' } : u))
    );
  };

  const uploadFile = async (
    file: File,
    options: {
      roomId?: string | null;
      isTemporary?: boolean;
      expiryHours?: number;
    } = {}
  ): Promise<FileRecord> => {
    const controller = new AbortController();
    abortControllers.current.set(file.name, controller);

    const initialProgress: UploadProgress = {
      file,
      progress: 0,
      uploadedBytes: 0,
      totalBytes: file.size,
      status: 'uploading'
    };

    setUploads((prev) => [initialProgress, ...prev.filter((u) => u.file.name !== file.name)]);

    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;

      // 1. Initialize Chunk Session
      const initRes = await api.initChunkUpload({
        originalName: file.name,
        fileSize: file.size,
        totalChunks,
        mimeType: file.type || 'application/octet-stream',
        roomId: options.roomId || null,
        isTemporary: options.isTemporary || false,
        expiryHours: options.expiryHours || 2
      });

      const { uploadId } = initRes;

      // 2. Upload Chunks Sequentially
      let uploadedBytes = 0;
      for (let i = 0; i < totalChunks; i++) {
        if (controller.signal.aborted) {
          throw new Error('Upload cancelled by user');
        }

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);

        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', i.toString());
        formData.append('chunk', chunkBlob, file.name);

        await api.uploadChunk(formData);

        uploadedBytes += (end - start);
        const progress = Math.min(Math.round((uploadedBytes / file.size) * 100), 99);

        setUploads((prev) =>
          prev.map((u) =>
            u.file.name === file.name
              ? { ...u, progress, uploadedBytes }
              : u
          )
        );
      }

      // 3. Complete & Assemble File on Server
      setUploads((prev) =>
        prev.map((u) =>
          u.file.name === file.name
            ? { ...u, status: 'assembling', progress: 99 }
            : u
        )
      );

      const completeRes = await api.completeChunkUpload(uploadId);
      const finalRecord: FileRecord = completeRes.file;

      setUploads((prev) =>
        prev.map((u) =>
          u.file.name === file.name
            ? { ...u, status: 'completed', progress: 100, result: finalRecord }
            : u
        )
      );

      abortControllers.current.delete(file.name);
      return finalRecord;
    } catch (err: any) {
      const isCancelled = controller.signal.aborted;
      const status = isCancelled ? 'cancelled' : 'error';
      const errorMessage = isCancelled ? 'Cancelled' : (err.message || 'Upload failed');

      setUploads((prev) =>
        prev.map((u) =>
          u.file.name === file.name
            ? { ...u, status, error: errorMessage }
            : u
        )
      );
      abortControllers.current.delete(file.name);
      throw err;
    }
  };

  const clearCompleted = () => {
    setUploads((prev) => prev.filter((u) => u.status === 'uploading' || u.status === 'assembling'));
  };

  return {
    uploads,
    uploadFile,
    cancelUpload,
    clearCompleted
  };
}
