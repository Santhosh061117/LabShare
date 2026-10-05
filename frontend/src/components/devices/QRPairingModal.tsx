import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api, setAuthToken } from '../../services/api';
import { wsManager } from '../../services/ws';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { QrCode, CheckCircle2, Clock, Smartphone, Laptop, Check } from 'lucide-react';

interface QRPairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'display' | 'approve';
}

export const QRPairingModal: React.FC<QRPairingModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'display'
}) => {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const { success, error } = useToast();
  const [mode, setMode] = useState<'display' | 'approve'>(defaultMode);
  
  // Display Mode States (Desktop)
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number>(120);
  const [isApproved, setIsApproved] = useState(false);

  // Approve Mode States (Mobile)
  const [inputCode, setInputCode] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  // Initialize pairing code when opening in display mode
  useEffect(() => {
    if (!isOpen || mode !== 'display') return;

    let timer: any = null;
    let pollInterval: any = null;

    api.initQrPairing(navigator.userAgent)
      .then(async (res) => {
        setPairingCode(res.code);
        setExpiresIn(res.expiresInSeconds || 120);

        // Tell WebSocket to listen for this pairing code
        wsManager.send('LISTEN_PAIRING', { pairingCode: res.code });

        // Generate QR code image
        const url = await QRCode.toDataURL(res.code, {
          width: 240,
          margin: 2,
          color: { dark: '#0f172a', light: '#ffffff' }
        });
        setQrDataUrl(url);

        // Start countdown
        timer = setInterval(() => {
          setExpiresIn((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // Polling fallback
        pollInterval = setInterval(async () => {
          try {
            const statusRes = await api.getQrPairingStatus(res.code);
            if (statusRes.status === 'approved' && statusRes.token) {
              clearInterval(pollInterval);
              clearInterval(timer);
              setIsApproved(true);
              setAuthToken(statusRes.token);
              wsManager.send('AUTH', { token: statusRes.token });
              await refreshUser();
              success('Computer successfully paired and logged in!');
              setTimeout(() => {
                onClose();
              }, 1200);
            }
          } catch (e) {
            // Ignore polling errors
          }
        }, 2000);
      })
      .catch((err) => {
        error(err.message || 'Failed to initialize QR pairing.');
      });

    return () => {
      if (timer) clearInterval(timer);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isOpen, mode, refreshUser, success, error, onClose]);

  // Handle mobile approval
  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    setIsApproving(true);
    try {
      await api.approveQrPairing(inputCode.trim());
      success('Device paired successfully!');
      setInputCode('');
      onClose();
    } catch (err: any) {
      error(err.message || 'Invalid or expired pairing code.');
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="QR Device Pairing">
      <div className="space-y-4">
        {/* Mode Selector */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setMode('display')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              mode === 'display'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" /> Pair This Computer
          </button>
          {isAuthenticated && (
            <button
              onClick={() => setMode('approve')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mode === 'approve'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Approve from Mobile
            </button>
          )}
        </div>

        {mode === 'display' ? (
          <div className="text-center py-2 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Scan this QR code or enter the PIN on your already logged-in phone to sign in immediately without typing passwords.
            </p>

            {isApproved ? (
              <div className="p-8 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex flex-col items-center gap-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-bounce" />
                <h4 className="text-base font-bold text-emerald-800 dark:text-emerald-200">
                  Pairing Approved!
                </h4>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Logging you in...
                </p>
              </div>
            ) : qrDataUrl ? (
              <div className="inline-block p-3 bg-white rounded-2xl shadow-md border border-slate-200 dark:border-slate-700">
                <img src={qrDataUrl} alt="Pairing QR Code" className="w-48 h-48 mx-auto" />
                <div className="mt-2 text-center">
                  <span className="text-xs text-slate-400">6-Digit PIN:</span>
                  <p className="text-2xl font-mono font-bold tracking-widest text-slate-900">
                    {pairingCode}
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-48 h-48 mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse flex items-center justify-center text-xs text-slate-400">
                Generating QR...
              </div>
            )}

            {!isApproved && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  Expires in <strong>{expiresIn}s</strong>
                </span>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleApprove} className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Enter 6-Digit PIN shown on the computer
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 482910"
                className="w-full text-center tracking-widest font-mono text-2xl py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1.5 text-center">
                This will create a secure trusted device session for that computer.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              isLoading={isApproving}
              disabled={inputCode.length < 6}
              icon={<Check className="w-4 h-4" />}
            >
              Approve Computer Pairing
            </Button>
          </form>
        )}
      </div>
    </Modal>
  );
};
