import { useEffect, useRef, useState } from 'react';

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

let scriptPromise;

function loadGoogleScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error('Google sign-in could not load. Check your connection and refresh the page.'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Shows Google's own button. onCredential receives the ID token for POST /auth/google.
export default function GoogleButton({ onCredential }) {
  const container = useRef(null);
  const callback = useRef(onCredential);
  const [problem, setProblem] = useState(CLIENT_ID ? '' : 'VITE_GOOGLE_CLIENT_ID is not set. See frontend/README.md.');

  callback.current = onCredential;

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !container.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => callback.current(response.credential),
        });
        window.google.accounts.id.renderButton(container.current, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          width: 320,
        });
      })
      .catch((error) => {
        if (!cancelled) setProblem(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (problem) return <p role="alert" className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">{problem}</p>;
  return <div ref={container} className="min-h-[44px] flex justify-center" />;
}
