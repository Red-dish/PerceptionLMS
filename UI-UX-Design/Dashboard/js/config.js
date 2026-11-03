/*
 * Perception LMS — deployment settings.
 * Edit this file before deploying. Nothing here is secret: a Google OAuth client ID is public.
 *
 * googleClientId  The "Web application" OAuth client ID from Google Cloud Console
 *                 (APIs & Services → Credentials). Add your deployed domain, e.g.
 *                 https://lms.example.com, and http://localhost:8080 under
 *                 "Authorized JavaScript origins". Leave empty to use the simulated
 *                 Google account picker (good for offline presentations).
 *
 * apiBaseUrl      The deployed backend (FastAPI on AWS Lambda), e.g.
 *                 https://abc123.execute-api.us-east-1.amazonaws.com. When set, the Google
 *                 ID token is sent to POST {apiBaseUrl}/auth/google, which verifies it and
 *                 returns the user's role. Your domain must be in the backend's ALLOWED_ORIGINS.
 *                 Leave empty for frontend-only mode (see below).
 *
 * allowedDomain   Optional Google Workspace domain, e.g. "asa.edu". Accounts from other
 *                 domains are refused (frontend-only mode; the backend has its own setting).
 *
 * adminEmails / lecturerEmails
 *                 Frontend-only mode: decides the role of a Google account. Anyone else
 *                 signs in with the role selected on the sign-in page. This is for demos
 *                 only — in production the backend decides roles.
 */
window.PERCEPTION_CONFIG = {
  googleClientId: '',
  apiBaseUrl: '',
  allowedDomain: '',
  adminEmails: [],
  lecturerEmails: []
};
