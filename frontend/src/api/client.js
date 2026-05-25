// If VITE_API_URL is set at build/dev time, use it.
// Otherwise, auto-resolve the API host from the browser's current hostname so
// the app works on both localhost AND LAN IP (e.g. 192.168.x.x) without any
// extra config.
function resolveApiUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:4000`;
  }
  return 'http://localhost:4000';
}
const API_URL = resolveApiUrl();

export class ApiError extends Error {
  constructor(message, { status, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest(path, { token, method = 'GET', body } = {}) {
  const headers = { accept: 'application/json' };
  if (body) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError('Unable to reach the API server. Check that backend is running on port 4000.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detailText = payload.error?.details ? Object.values(payload.error.details).join(' ') : '';
    const message = [payload.error?.message || 'Request failed.', detailText].filter(Boolean).join(' ');
    throw new ApiError(message, { status: response.status, details: payload.error?.details });
  }
  return payload;
}

export { API_URL };
