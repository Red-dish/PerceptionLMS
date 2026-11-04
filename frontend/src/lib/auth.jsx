import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError, getToken, SESSION_EXPIRED_EVENT, setToken } from './api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!getToken()) return undefined;
    let cancelled = false;
    api
      .get('/me')
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch((error) => {
        if (cancelled) return;
        // A 401 has its own message, from the event below.
        if (!(error instanceof ApiError && error.status === 401)) setNotice(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setNotice('Your session has ended. Please sign in again.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // credential is the ID token from Google's "Sign in with Google" button.
  const signIn = useCallback(async (credential) => {
    setNotice('');
    const { access_token: token, user: signedIn } = await api.post('/auth/google', { credential });
    setToken(token);
    setUser(signedIn);
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    setNotice('');
    window.google?.accounts?.id?.disableAutoSelect();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, notice, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
