import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { BookOpen, ClipboardList, GraduationCap, Megaphone } from 'lucide-react';
import GoogleButton from '../components/GoogleButton';
import { ErrorNote, Loading } from '../components/ui';
import { useAuth } from '../lib/auth';

const highlights = [
  [BookOpen, 'Course modules and materials'],
  [ClipboardList, 'Assignments, submissions and marks'],
  [Megaphone, 'Announcements from your lecturers'],
];

export default function Login() {
  const { user, loading, notice, signIn } = useAuth();
  const [error, setError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onCredential = async (credential) => {
    setError(null);
    setSigningIn(true);
    try {
      await signIn(credential);
    } catch (problem) {
      setError(problem);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 text-white">
        <div className="flex items-center gap-3 text-xl font-bold">
          <div className="w-10 h-10 rounded-xl bg-white/15 grid place-items-center">
            <GraduationCap aria-hidden="true" />
          </div>
          Perception LMS
        </div>
        <div>
          <h2 className="text-4xl font-bold leading-tight mb-4">Everything for your courses, in one place.</h2>
          <ul className="space-y-3 text-blue-100">
            {highlights.map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <Icon size={18} aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-blue-200">ASA College</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-slate-500 mt-1 mb-8">Sign in with the Google account your college added.</p>
          {loading || signingIn ? <Loading label="Signing you in…" /> : null}
          {/* Stays mounted while signing in, because Google's button can't be drawn twice in a row reliably. */}
          <div className={loading || signingIn ? 'hidden' : ''}>
            <GoogleButton onCredential={onCredential} />
          </div>
          <div className="mt-4 space-y-2">
            <ErrorNote error={error} />
            {!error && <ErrorNote error={notice || null} />}
          </div>
        </div>
      </div>
    </div>
  );
}
