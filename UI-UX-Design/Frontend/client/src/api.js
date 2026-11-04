const req = async (method, url, body) => {
  const r = await fetch('/api' + url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401 && !url.startsWith('/auth/login')) { localStorage.removeItem('token'); if (location.pathname !== '/login') location.href = '/login'; }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Request failed'); return data;
};
export const api = { get: u => req('GET', u), post: (u, b) => req('POST', u, b), put: (u, b) => req('PUT', u, b), del: u => req('DELETE', u) };
