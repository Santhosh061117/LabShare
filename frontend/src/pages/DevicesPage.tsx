import React, { useState, useEffect } from 'react';
import { 
  Laptop2, 
  Smartphone, 
  ShieldCheck, 
  Trash2, 
  LogOut, 
  QrCode, 
  Clock, 
  Globe, 
  User 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { QRPairingModal } from '../components/devices/QRPairingModal';

export const DevicesPage: React.FC = () => {
  const { user, devices, loadDevices, revokeDevice, logoutAllOtherDevices, logout } = useAuth();
  const { success, error } = useToast();
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrModalMode, setQrModalMode] = useState<'display' | 'approve'>('display');
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  useEffect(() => {
    loadDevices();
  }, []);

  const handleRevoke = async (deviceId: string) => {
    try {
      await revokeDevice(deviceId);
      success('Device session revoked.');
    } catch (err: any) {
      error(err.message || 'Failed to revoke device.');
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('Are you sure you want to log out from all other devices?')) return;
    setIsLoggingOutAll(true);
    try {
      await logoutAllOtherDevices();
      success('Logged out all other devices.');
    } catch (err: any) {
      error(err.message || 'Failed to logout other devices.');
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  const formatLastActive = (ts?: number) => {
    if (!ts) return 'Never';
    const diff = Date.now() - ts;
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 m-0">
            Trusted Devices & Sessions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage devices with persistent login and pair new computers via QR code without typing credentials.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setQrModalMode('display');
              setShowQrModal(true);
            }}
            icon={<QrCode className="w-4 h-4" />}
          >
            Pair New Device
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setQrModalMode('approve');
              setShowQrModal(true);
            }}
            icon={<Smartphone className="w-4 h-4" />}
          >
            Approve QR Code
          </Button>
        </div>
      </div>

      {/* Profile Card */}
      {user && (
        <Card className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-bold flex items-center justify-center text-lg shadow-md shadow-blue-500/20">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                {user.displayName}
              </h3>
              <p className="text-xs text-slate-400">@{user.username} • {user.role}</p>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={logout}
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            icon={<LogOut className="w-4 h-4" />}
          >
            Sign Out
          </Button>
        </Card>
      )}

      {/* Active Devices Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 m-0">
            Active Devices ({devices.length})
          </h2>
          {devices.length > 1 && (
            <Button
              size="sm"
              variant="outline"
              className="text-rose-600 hover:text-rose-700 text-xs py-1"
              onClick={handleLogoutAll}
              isLoading={isLoggingOutAll}
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Logout All Other Devices
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {devices.map((device) => {
            const isCurrent = device.is_current === 1;

            return (
              <Card
                key={device.id}
                className={`p-4 flex items-center justify-between gap-4 ${
                  isCurrent ? 'border-l-4 border-l-blue-600' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                    {device.device_name?.toLowerCase().includes('android') ||
                    device.device_name?.toLowerCase().includes('ios') ? (
                      <Smartphone className="w-5 h-5" />
                    ) : (
                      <Laptop2 className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {device.device_name || 'Generic Device'}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                          Current Device
                        </span>
                      )}
                      {device.is_trusted === 1 && (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <ShieldCheck className="w-3 h-3" /> Trusted
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Active: {formatLastActive(device.last_active_at)}
                      </span>
                      {device.ip_address && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Globe className="w-3 h-3" /> {device.ip_address}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {!isCurrent && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRevoke(device.id)}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-2"
                    title="Revoke session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* QR Pairing Modal */}
      <QRPairingModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        defaultMode={qrModalMode}
      />
    </div>
  );
};
