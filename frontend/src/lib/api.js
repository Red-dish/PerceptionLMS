// Every request to the backend goes through this file.

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const TOKEN_KEY = 'perception_token';

export const MAX_UPLOAD_MB = 20;
export const SESSION_EXPIRED_EVENT = 'perception:session-expired';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Without storage the session lasts until the page reloads.
  }
}

// FastAPI sends "detail" as a string, or as a list of field errors when validation fails.
function errorMessage(body) {
  const detail = body?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) return detail.map((item) => item.msg).join('. ');
  return 'Something went wrong. Please try again.';
}

async function request(method, path, body) {
  if (!API_URL) throw new ApiError('VITE_API_URL is not set. See frontend/README.md.', 0);

  const token = getToken();
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(API_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }

  // Session tokens last 8 hours. A 401 means this one has expired or the user was deactivated.
  if (response.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(errorMessage(data), response.status);
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};

export function fileProblem(file) {
  if (file && file.size > MAX_UPLOAD_MB * 1024 * 1024) return `Files can be up to ${MAX_UPLOAD_MB} MB.`;
  if (file && file.size === 0) return 'This file is empty.';
  return null;
}

// Files go straight to S3 with the signed form the API returned, not through the API.
// S3 needs every signed field first and the file last.
export async function uploadFile(ticket, file) {
  const form = new FormData();
  Object.entries(ticket.fields).forEach(([name, value]) => form.append(name, value));
  form.append('file', file);

  let response;
  try {
    response = await fetch(ticket.url, { method: 'POST', body: form });
  } catch {
    throw new ApiError('The file could not be uploaded. Check your connection and try again.', 0);
  }
  if (!response.ok) throw new ApiError('The file could not be uploaded. Please try again.', response.status);
}

// Download links are signed and last 5 minutes, so fetch one only when it is clicked.
export async function openDownload(path) {
  const { url } = await api.get(path);
  window.location.assign(url);
}
