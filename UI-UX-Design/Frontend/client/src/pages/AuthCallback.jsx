import { useEffect } from 'react'; import { useNavigate, useSearchParams } from 'react-router-dom'; import { useAuth } from '../auth';
export default function AuthCallback() { const [sp] = useSearchParams(); const { loginToken } = useAuth(); const nav = useNavigate();
  useEffect(() => { const t = sp.get('token'); t ? loginToken(t).then(() => nav('/')) : nav('/login'); }, []); return <div className="h-screen grid place-items-center">Signing you in…</div>; }
