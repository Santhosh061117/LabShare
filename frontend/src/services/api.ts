export function getApiBaseUrl(): string {
  const saved = localStorage.getItem('labshare_api_url');
  if (saved && saved.trim()) {
    return saved.trim().replace(/\/+$/, '');
  }

  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // If running in development with Vite proxy or hosted alongside backend
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
  }

  return 'http://localhost:3000';
}

export function setApiBaseUrl(url: string): void {
  if (!url || !url.trim()) {
    localStorage.removeItem('labshare_api_url');
  } else {
    localStorage.setItem('labshare_api_url', url.trim().replace(/\/+$/, ''));
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem('labshare_token');
}

export function setAuthToken(token: string | null): void {
  if (!token) {
    localStorage.removeItem('labshare_token');
  } else {
    localStorage.setItem('labshare_token', token);
  }
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${cleanPath}`;

  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const guestName = localStorage.getItem('labshare_guest_name');
  if (guestName && !headers.has('x-guest-name')) {
    headers.set('x-guest-name', guestName);
  }

  const res = await fetch(url, {
    ...options,
    headers
  });

  const contentType = res.headers.get('content-type') || '';
  let data: any = null;

  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const errorMsg = data?.error || (typeof data === 'string' ? data : `Request failed with status ${res.status}`);
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Health
  getHealth: () => apiRequest('/api/health'),

  // Auth
  register: (body: any) => apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: any) => apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  getMe: () => apiRequest('/api/auth/me'),
  logout: () => apiRequest('/api/auth/logout', { method: 'POST' }),
  getDevices: () => apiRequest('/api/auth/devices'),
  revokeDevice: (id: string) => apiRequest(`/api/auth/devices/${id}`, { method: 'DELETE' }),
  logoutAllDevices: () => apiRequest('/api/auth/devices/logout-all', { method: 'POST' }),

  // QR Pairing
  initQrPairing: (deviceName?: string) => apiRequest('/api/auth/qr-pair/init', { method: 'POST', body: JSON.stringify({ deviceName }) }),
  getQrPairingStatus: (code: string) => apiRequest(`/api/auth/qr-pair/status/${code}`),
  approveQrPairing: (code: string) => apiRequest('/api/auth/qr-pair/approve', { method: 'POST', body: JSON.stringify({ code }) }),

  // Rooms
  getRooms: () => apiRequest('/api/rooms'),
  getRoom: (id: string) => apiRequest(`/api/rooms/${id}`),
  createRoom: (body: any) => apiRequest('/api/rooms', { method: 'POST', body: JSON.stringify(body) }),
  joinRoom: (body: any) => apiRequest('/api/rooms/join', { method: 'POST', body: JSON.stringify(body) }),
  closeRoom: (id: string) => apiRequest(`/api/rooms/${id}/close`, { method: 'POST' }),
  deleteRoom: (id: string) => apiRequest(`/api/rooms/${id}`, { method: 'DELETE' }),
  kickMember: (roomId: string, userId: string) => apiRequest(`/api/rooms/${roomId}/members/${userId}`, { method: 'DELETE' }),

  // Messages
  getMessages: (roomId: string, limit = 50, before = 0) => 
    apiRequest(`/api/rooms/${roomId}/messages?limit=${limit}&before=${before}`),
  sendMessage: (roomId: string, body: any) => 
    apiRequest(`/api/rooms/${roomId}/messages`, { method: 'POST', body: JSON.stringify(body) }),
  editMessage: (roomId: string, messageId: string, content: string) => 
    apiRequest(`/api/rooms/${roomId}/messages/${messageId}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deleteMessage: (roomId: string, messageId: string) => 
    apiRequest(`/api/rooms/${roomId}/messages/${messageId}`, { method: 'DELETE' }),
  toggleReaction: (roomId: string, messageId: string, emoji: string) => 
    apiRequest(`/api/rooms/${roomId}/messages/${messageId}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }),
  togglePin: (roomId: string, messageId: string) => 
    apiRequest(`/api/rooms/${roomId}/messages/${messageId}/pin`, { method: 'POST' }),
  toggleBookmark: (roomId: string, messageId: string) => 
    apiRequest(`/api/rooms/${roomId}/messages/${messageId}/bookmark`, { method: 'POST' }),
  searchMessages: (roomId: string, q: string) => 
    apiRequest(`/api/rooms/${roomId}/messages/search?q=${encodeURIComponent(q)}`),

  // Files
  getRoomFiles: (roomId: string) => apiRequest(`/api/files/room/${roomId}`),
  initChunkUpload: (body: any) => apiRequest('/api/files/chunk/init', { method: 'POST', body: JSON.stringify(body) }),
  uploadChunk: (formData: FormData) => apiRequest('/api/files/chunk', { method: 'POST', body: formData }),
  completeChunkUpload: (uploadId: string) => apiRequest('/api/files/chunk/complete', { method: 'POST', body: JSON.stringify({ uploadId }) }),
  deleteFile: (id: string) => apiRequest(`/api/files/${id}`, { method: 'DELETE' }),
  getFileDownloadUrl: (id: string) => `${getApiBaseUrl()}/api/files/${id}/download`,
  getFileViewUrl: (id: string) => `${getApiBaseUrl()}/api/files/${id}/view`,
  getFileText: (id: string) => apiRequest(`/api/files/${id}/text`),

  // Quick Transfer
  createQuickTransfer: () => apiRequest('/api/quick-transfer/create', { method: 'POST' }),
  getQuickTransfer: (code: string) => apiRequest(`/api/quick-transfer/${code}`),

  // Clipboard
  getClipboard: (roomId: string) => apiRequest(`/api/clipboard/room/${roomId}`),
  shareClipboard: (roomId: string, content: string) => apiRequest('/api/clipboard', { method: 'POST', body: JSON.stringify({ roomId, content }) }),
  deleteClipboard: (id: string) => apiRequest(`/api/clipboard/${id}`, { method: 'DELETE' }),

  // Storage
  getStorageStats: () => apiRequest('/api/storage/stats'),
  runStorageCleanup: () => apiRequest('/api/storage/cleanup', { method: 'POST' }),

  // Data Privacy
  exportDataUrl: () => `${getApiBaseUrl()}/api/auth/export-data`,
  deleteAccount: () => apiRequest('/api/auth/account', { method: 'DELETE' })
};
