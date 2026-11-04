import { createContext, useContext, useEffect, useState } from 'react'; import { api } from './api';
const Ctx = createContext(null); export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(true);
  const loadMe = () => api.get('/auth/me').then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  useEffect(() => { localStorage.getItem('token') ? loadMe() : setLoading(false); }, []);
  const login = async (email, password) => { const r = await api.post('/auth/login', { email, password }); localStorage.setItem('token', r.token); setUser(r.user); };
  const loginToken = async t => { localStorage.setItem('token', t); setLoading(true); await loadMe(); };
  const logout = () => { localStorage.removeItem('token'); setUser(null); };
  return <Ctx.Provider value={{ user, loading, login, loginToken, logout }}>{children}</Ctx.Provider>;
}
