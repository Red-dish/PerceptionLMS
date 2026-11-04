/*
 * Perception LMS — interactive frontend prototype.
 * Plain JavaScript, no build step. Hash routes (#/dashboard, #/modules/<id>, …) so it runs
 * on any static host without rewrite rules.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Config, storage and session
  // ---------------------------------------------------------------------------
  var CFG = Object.assign({ googleClientId: '', apiBaseUrl: '', allowedDomain: '', adminEmails: [], lecturerEmails: [] }, window.PERCEPTION_CONFIG || {});
  var STATE_KEY = 'perception-lms-state-v1';
  var SESSION_KEY = 'perception-lms-session';
  var THEME_KEY = 'perception-theme';

  function safeGet(storage, key) { try { return window[storage].getItem(key); } catch (e) { return null; } }
  function safeSet(storage, key, value) { try { window[storage].setItem(key, value); } catch (e) { /* storage blocked */ } }
  function safeRemove(storage, key) { try { window[storage].removeItem(key); } catch (e) { /* storage blocked */ } }

  function loadState() {
    var raw = safeGet('localStorage', STATE_KEY);
    if (raw) { try { var s = JSON.parse(raw); if (s && s.version === 1) return s; } catch (e) { /* corrupt */ } }
    return window.PerceptionSeed();
  }
  var state = loadState();
  function save() { safeSet('localStorage', STATE_KEY, JSON.stringify(state)); }

  function getSession() {
    var raw = safeGet('sessionStorage', SESSION_KEY) || safeGet('localStorage', SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function setSession(s, remember) {
    session = s;
    safeRemove('localStorage', SESSION_KEY); safeRemove('sessionStorage', SESSION_KEY);
    safeSet(remember ? 'localStorage' : 'sessionStorage', SESSION_KEY, JSON.stringify(s));
  }
  function clearSession() { session = null; safeRemove('localStorage', SESSION_KEY); safeRemove('sessionStorage', SESSION_KEY); }
  var session = getSession();

  function me() {
    if (!session) return null;
    var u = userById(session.userId);
    if (!u || !u.active) return null;
    if (session.sso) return Object.assign({}, u, { name: session.sso.name || u.name, email: session.sso.email || u.email, picture: session.sso.picture || null, provider: session.sso.provider });
    return Object.assign({}, u, { provider: 'password' });
  }

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------
  var ui = {
    loginRole: 'student', loginError: '', loginLoading: false, showPassword: false,
    menuOpen: false, popover: null,
    q: { modules: '', assignments: '', users: '' },
    courseFilter: { assignments: 'all', announcements: 'all' },
    userRole: 'all', gradebookCourse: null, enrolCourse: null,
    openModules: {}, pending: { id: null, files: [] }, drafts: {}, confirmOwn: {}, resubmit: {},
    lastRoute: ''
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name, cls) { return '<i data-lucide="' + name + '"' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true"></i>'; }
  function refreshIcons() { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); }
  function uid(prefix) { state.nextId += 1; return prefix + '-' + state.nextId + '-' + Math.random().toString(36).slice(2, 6); }
  function initials(name) { return String(name || '?').replace(/^(Dr\.|Prof\.)\s*/, '').split(/\s+/).map(function (p) { return p[0]; }).slice(0, 2).join('').toUpperCase(); }
  function avatar(u, cls) {
    if (u.picture) return '<img class="avatar ' + (cls || '') + '" src="' + esc(u.picture) + '" alt="" referrerpolicy="no-referrer">';
    return '<span class="avatar ' + (cls || '') + '" style="background:' + esc(u.color || '#3c886d') + '" aria-hidden="true">' + esc(initials(u.name)) + '</span>';
  }
  var dfDay = new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  var dfFull = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  var dfTime = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  function fmtDay(iso) { return dfDay.format(new Date(iso)); }
  function fmtFull(iso) { return dfFull.format(new Date(iso)); }
  function fmtTime(iso) { return dfTime.format(new Date(iso)); }
  function dayDiff(iso) {
    var a = new Date(iso); a.setHours(0, 0, 0, 0);
    var b = new Date(); b.setHours(0, 0, 0, 0);
    return Math.round((a - b) / 86400000);
  }
  function relDue(iso) {
    var ms = new Date(iso) - new Date();
    var d = dayDiff(iso);
    if (ms < 0) { var late = -d; return late <= 0 ? 'Overdue today' : 'Overdue by ' + late + ' day' + (late === 1 ? '' : 's'); }
    if (d === 0) return 'Due today';
    if (d === 1) return 'Due tomorrow';
    return 'Due in ' + d + ' days';
  }
  function ago(iso) {
    var d = -dayDiff(iso);
    if (d <= 0) return 'Today';
    if (d === 1) return 'Yesterday';
    if (d < 7) return d + ' days ago';
    return fmtFull(iso);
  }
  function dateChip(iso, urgent) {
    var d = new Date(iso);
    return '<div class="date-chip' + (urgent ? ' urgent' : '') + '"><div class="d">' + d.getDate() + '</div><div class="m">' + d.toLocaleString('en-AU', { month: 'short' }) + '</div></div>';
  }
  function prose(text) {
    var lines = String(text || '').split('\n'), out = '', list = [], para = [];
    function flushPara() { if (para.length) { out += '<p>' + para.map(esc).join('<br>') + '</p>'; para = []; } }
    function flushList() { if (list.length) { out += '<ul>' + list.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>'; list = []; } }
    lines.forEach(function (l) {
      if (/^\s*-\s+/.test(l)) { flushPara(); list.push(l.replace(/^\s*-\s+/, '')); }
      else if (!l.trim()) { flushPara(); flushList(); }
      else { flushList(); para.push(l); }
    });
    flushPara(); flushList();
    return out;
  }
  function fileColor(name) {
    var ext = String(name).split('.').pop().toLowerCase();
    return { pdf: '#b93a2e', pptx: '#c4561c', ppt: '#c4561c', docx: '#2b5797', doc: '#2b5797', xlsx: '#1e7145', csv: '#1e7145', zip: '#5f6b6d', ipynb: '#d9771c', png: '#7b4f9d', jpg: '#7b4f9d', jpeg: '#7b4f9d', py: '#3a6e9e', txt: '#5f7472' }[ext] || '#5f7472';
  }
  function fileIcon(name) { var ext = String(name).split('.').pop().toUpperCase().slice(0, 4); return '<span class="file-ic" style="background:' + fileColor(name) + '">' + esc(ext) + '</span>'; }
  function fmtSize(bytes) { if (bytes < 1024) return bytes + ' B'; if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB'; return (bytes / 1048576).toFixed(1) + ' MB'; }
  function greeting() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
  function firstName(name) { return String(name).replace(/^(Dr\.|Prof\.)\s*/, '').split(' ')[0]; }
  function receipt() {
    var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
    return 'PLMS-' + s + '-' + String(Math.floor(1000 + Math.random() * 9000));
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ---------------------------------------------------------------------------
  // Domain queries
  // ---------------------------------------------------------------------------
  function userById(id) { return state.users.find(function (u) { return u.id === id; }); }
  function courseById(id) { return state.courses.find(function (c) { return c.id === id; }); }
  function assignmentById(id) { return state.assignments.find(function (a) { return a.id === id; }); }
  function isStaff(u) { return u.role === 'lecturer' || u.role === 'admin'; }
  function enrolled(courseId) { return state.enrolments[courseId] || []; }
  function coursesFor(u) {
    if (u.role === 'admin') return state.courses.slice();
    if (u.role === 'lecturer') return state.courses.filter(function (c) { return c.lecturerId === u.id; });
    return state.courses.filter(function (c) { return enrolled(c.id).indexOf(u.id) !== -1; });
  }
  function canAccessCourse(u, c) { return !!c && coursesFor(u).some(function (x) { return x.id === c.id; }); }
  function visibleModules(u, c) { return u.role === 'student' ? c.modules.filter(function (m) { return m.published; }) : c.modules; }
  function allLessons(c) { var out = []; c.modules.filter(function (m) { return m.published; }).forEach(function (m) { out = out.concat(m.lessons); }); return out; }
  function isDone(userId, lessonId) { return !!(state.progress[userId] && state.progress[userId][lessonId]); }
  function courseProgress(userId, c) {
    var lessons = allLessons(c); if (!lessons.length) return 0;
    var done = lessons.filter(function (l) { return isDone(userId, l.id); }).length;
    return Math.round(done / lessons.length * 100);
  }
  function assignmentsFor(u) {
    var ids = coursesFor(u).map(function (c) { return c.id; });
    return state.assignments.filter(function (a) { return ids.indexOf(a.courseId) !== -1 && (u.role !== 'student' || a.published); })
      .sort(function (a, b) { return new Date(a.due) - new Date(b.due); });
  }
  function submissionOf(aId, sId) { return state.submissions.find(function (s) { return s.assignmentId === aId && s.studentId === sId; }); }
  function submissionsFor(aId) { return state.submissions.filter(function (s) { return s.assignmentId === aId; }); }
  function studentStatus(a, userId) {
    var s = submissionOf(a.id, userId);
    if (s && s.grade) return 'graded';
    if (s) return 'submitted';
    if (new Date(a.due) < new Date()) return 'overdue';
    return 'todo';
  }
  var STATUS = { todo: ['To do', 'info'], submitted: ['Submitted', ''], graded: ['Graded', ''], overdue: ['Overdue', 'danger'] };
  function statusBadge(st) { var s = STATUS[st]; return '<span class="badge ' + s[1] + '">' + (st === 'graded' ? icon('circle-check', 'ic-sm') : '') + s[0] + '</span>'; }
  function toGrade(u) {
    var ids = assignmentsFor(u).map(function (a) { return a.id; });
    return state.submissions.filter(function (s) { return ids.indexOf(s.assignmentId) !== -1 && !s.grade; })
      .sort(function (a, b) { return new Date(a.submittedAt) - new Date(b.submittedAt); });
  }
  function gradedFor(userId) {
    return state.submissions.filter(function (s) { return s.studentId === userId && s.grade; }).map(function (s) { return { s: s, a: assignmentById(s.assignmentId) }; }).filter(function (x) { return x.a; });
  }
  function avgGrade(userId) {
    var g = gradedFor(userId); if (!g.length) return null;
    return Math.round(g.reduce(function (t, x) { return t + x.s.grade.score / x.a.points * 100; }, 0) / g.length);
  }
  function announcementsFor(u) {
    var ids = coursesFor(u).map(function (c) { return c.id; });
    return state.announcements.filter(function (n) { return n.courseId === null || ids.indexOf(n.courseId) !== -1; })
      .sort(function (a, b) { return (b.pinned - a.pinned) || (new Date(b.date) - new Date(a.date)); });
  }
  function studentsOf(courseId) { return enrolled(courseId).map(userById).filter(Boolean); }

  // ---------------------------------------------------------------------------
  // Routing
  // ---------------------------------------------------------------------------
  var NAV = {
    student: [['dashboard', 'Dashboard', 'layout-dashboard'], ['modules', 'My Modules', 'book-open']],
    lecturer: [['dashboard', 'Dashboard', 'layout-dashboard'], ['modules', 'My Modules', 'book-open']],
    admin: [['dashboard', 'Dashboard', 'layout-dashboard'], ['modules', 'All Modules', 'book-open']]
  };
  function route() {
    var h = location.hash.replace(/^#/, '') || '/dashboard';
    var parts = h.split('?'), path = parts[0].split('/').filter(Boolean);
    return { page: path[0] || 'dashboard', id: path[1] ? decodeURIComponent(path[1]) : null, params: new URLSearchParams(parts[1] || '') };
  }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function allowed(u, page) { return NAV[u.role].some(function (n) { return n[0] === page; }); }

  // ---------------------------------------------------------------------------
  // Toasts and modals
  // ---------------------------------------------------------------------------
  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.innerHTML = icon(type === 'error' ? 'circle-alert' : 'circle-check') + '<span>' + esc(msg) + '</span>';
    $('toast-root').appendChild(el); refreshIcons();
    setTimeout(function () { el.remove(); }, 3800);
  }

  var modalSubmit = null, modalLastFocus = null;
  function openModal(o) {
    modalLastFocus = document.activeElement;
    modalSubmit = o.onSubmit || null;
    var foot = o.foot === undefined
      ? '<button type="button" class="btn btn-soft" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-primary">' + esc(o.submitLabel || 'Save') + '</button>'
      : o.foot;
    $('modal-root').innerHTML =
      '<div class="modal-back" data-modal-back><form class="modal' + (o.wide ? ' wide' : '') + '" id="modal-form" role="dialog" aria-modal="true" aria-labelledby="modal-title" novalidate>' +
      '<div class="modal-head"><div>' + (o.kicker ? '<p class="kicker">' + esc(o.kicker) + '</p>' : '') + '<h2 id="modal-title" class="serif">' + esc(o.title) + '</h2></div>' +
      '<button type="button" class="icon-btn" data-action="close-modal" aria-label="Close dialog">' + icon('x') + '</button></div>' +
      '<div class="modal-body">' + o.body + '<p id="modal-error" class="alert" hidden></p></div>' +
      (foot ? '<div class="modal-foot">' + foot + '</div>' : '') + '</form></div>';
    refreshIcons();
    var first = $('modal-form').querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select');
    (first || $('modal-form').querySelector('button[type=submit], .btn-primary') || $('modal-form')).focus();
  }
  function closeModal() {
    $('modal-root').innerHTML = ''; modalSubmit = null;
    if (modalLastFocus && document.contains(modalLastFocus)) modalLastFocus.focus();
  }
  function modalError(msg) { var e = $('modal-error'); if (!e) return; e.hidden = !msg; e.innerHTML = msg ? icon('circle-alert') + '<span>' + esc(msg) + '</span>' : ''; refreshIcons(); }
  function confirmModal(title, text, label, fn, danger) {
    openModal({ title: title, body: '<p class="muted">' + esc(text) + '</p>', foot: '<button type="button" class="btn btn-soft" data-action="close-modal">Cancel</button><button type="submit" class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '">' + esc(label) + '</button>', onSubmit: function () { closeModal(); fn(); } });
  }
  function field(name, label, value, opts) {
    opts = opts || {};
    var id = 'f-' + name, input;
    if (opts.type === 'textarea') input = '<textarea class="field" id="' + id + '" name="' + name + '" ' + (opts.required ? 'required' : '') + ' placeholder="' + esc(opts.placeholder || '') + '">' + esc(value) + '</textarea>';
    else if (opts.type === 'select') input = '<select class="field" id="' + id + '" name="' + name + '">' + opts.options.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
    else input = '<input class="field" id="' + id + '" name="' + name + '" type="' + (opts.type || 'text') + '" value="' + esc(value) + '" ' + (opts.required ? 'required' : '') + (opts.min != null ? ' min="' + opts.min + '"' : '') + (opts.max != null ? ' max="' + opts.max + '"' : '') + ' placeholder="' + esc(opts.placeholder || '') + '" maxlength="' + (opts.maxlength || 200) + '">';
    return '<div class="field-group' + (opts.full ? ' full' : '') + '"><label for="' + id + '">' + esc(label) + '</label>' + input + (opts.hint ? '<span class="small muted">' + esc(opts.hint) + '</span>' : '') + '</div>';
  }

  // ---------------------------------------------------------------------------
  // Login + Google SSO
  // ---------------------------------------------------------------------------
  var DEMO = { student: 'student@perception.demo', lecturer: 'lecturer@perception.demo', admin: 'admin@perception.demo' };
  function renderLogin() {
    document.title = 'Sign in · Perception LMS';
    var roles = [['student', 'Student', 'graduation-cap'], ['lecturer', 'Lecturer', 'presentation'], ['admin', 'Admin', 'shield-check']];
    var googleBlock = CFG.googleClientId
      ? '<div id="gsi-btn" class="gsi-wrap" style="min-height:44px;display:flex;justify-content:center"></div>'
      : '<button type="button" class="btn btn-google" data-action="google-demo">' + googleLogo() + 'Continue with Google</button>';
    $('app').innerHTML =
      '<div class="login">' +
      '<section class="login-hero"><div class="brand"><span class="brand-mark">' + icon('graduation-cap') + '</span>PERCEPTION LMS</div>' +
      '<div><p class="kicker" style="color:#e9a27c">ASA College · eLearning</p><h1 class="serif">One place for every part of learning.</h1>' +
      '<p class="lead">Your modules, assignments, grades and announcements — together in one simple, accessible platform.</p>' +
      '<div class="hero-points">' +
      heroPoint('book-open', 'Learn anywhere', 'Open modules, lessons and downloadable materials on any device.') +
      heroPoint('clipboard-check', 'Submit with confidence', 'Upload work online and get an instant submission receipt.') +
      heroPoint('chart-no-axes-column', 'Track your progress', 'See deadlines, grades and lecturer feedback at a glance.') +
      '</div></div><p class="hero-foot small" style="color:#8fb3a4">© 2026 Perception LMS · Prototype for ASA College</p></section>' +
      '<section class="login-panel"><div class="login-card reveal">' +
      '<h2 class="serif">Welcome back</h2><p class="muted mt-1">Sign in to continue to your learning space.</p>' +
      '<div class="role-tabs" role="radiogroup" aria-label="Sign in as">' + roles.map(function (r) {
        return '<button type="button" role="radio" class="role-tab" aria-checked="' + (ui.loginRole === r[0]) + '" data-action="pick-role" data-role="' + r[0] + '">' + icon(r[2], 'ic-sm') + r[1] + '</button>';
      }).join('') + '</div>' +
      googleBlock +
      '<div class="divider">or sign in with email</div>' +
      '<form id="login-form" class="stack" style="gap:14px" novalidate>' +
      (ui.loginError ? '<div class="alert" role="alert">' + icon('circle-alert') + '<span>' + esc(ui.loginError) + '</span></div>' : '') +
      '<div class="field-group"><label for="login-email">Email</label><div class="input-icon">' + icon('mail') + '<input class="field" id="login-email" name="email" type="email" autocomplete="username" placeholder="you@asa.edu" required></div></div>' +
      '<div class="field-group"><div class="row between"><label for="login-password">Password</label><button type="button" class="btn-ghost small" style="font-weight:700" data-action="forgot-password">Forgot password?</button></div>' +
      '<div class="input-icon">' + icon('lock') + '<input class="field" id="login-password" name="password" type="' + (ui.showPassword ? 'text' : 'password') + '" autocomplete="current-password" placeholder="Enter your password" required>' +
      '<button type="button" class="icon-btn trailing" style="width:36px;height:36px" data-action="toggle-password" aria-label="' + (ui.showPassword ? 'Hide' : 'Show') + ' password">' + icon(ui.showPassword ? 'eye-off' : 'eye') + '</button></div></div>' +
      '<label class="check"><input type="checkbox" name="remember" checked> Keep me signed in</label>' +
      '<button type="submit" class="btn btn-primary btn-block" ' + (ui.loginLoading ? 'disabled' : '') + '>' + (ui.loginLoading ? '<span class="spinner"></span> Signing in…' : 'Sign in ' + icon('arrow-right')) + '</button>' +
      '</form>' +
      '<div class="demo-box"><div class="row between"><strong>Demo accounts</strong><button type="button" class="btn btn-ghost btn-sm" data-action="fill-demo">Fill ' + esc(ui.loginRole) + ' login</button></div>' +
      '<p class="muted mt-1">Student <code>student@perception.demo</code> / <code>Student@123</code><br>Lecturer <code>lecturer@perception.demo</code> / <code>Lecturer@123</code><br>Admin <code>admin@perception.demo</code> / <code>Admin@123</code></p>' +
      (CFG.googleClientId ? '' : '<p class="small muted mt-1">Google sign-in is in demo mode. Add a Google client ID in <code>js/config.js</code> to use real Google accounts.</p>') +
      '</div></div></section></div>';
    refreshIcons();
    if (CFG.googleClientId) mountGoogleButton();
  }
  function heroPoint(ic, t, d) { return '<div class="hero-point"><span class="ic">' + icon(ic) + '</span><div><strong>' + t + '</strong><span class="small">' + d + '</span></div></div>'; }
  function googleLogo() {
    return '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>';
  }

  function doLogin(form) {
    var data = new FormData(form), email = String(data.get('email') || '').trim().toLowerCase(), pw = String(data.get('password') || '');
    var emailEl = $('login-email'), pwEl = $('login-password');
    emailEl.classList.toggle('invalid', !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email));
    pwEl.classList.toggle('invalid', !pw);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !pw) { ui.loginError = !email ? 'Enter your email address.' : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? 'Enter a valid email address.' : 'Enter your password.'; rerenderLoginKeeping(email); return; }
    ui.loginLoading = true; ui.loginError = ''; rerenderLoginKeeping(email, pw);
    wait(650).then(function () {
      ui.loginLoading = false;
      var u = state.users.find(function (x) { return x.email.toLowerCase() === email; });
      if (!u || !u.password || u.password !== pw) { ui.loginError = 'Incorrect email or password. Check the demo accounts below.'; rerenderLoginKeeping(email); return; }
      if (!u.active) { ui.loginError = 'Your account has been deactivated. Contact an administrator.'; rerenderLoginKeeping(email); return; }
      setSession({ userId: u.id }, data.get('remember') === 'on');
      toast('Signed in as ' + u.name);
      go('#/dashboard');
    });
  }
  function rerenderLoginKeeping(email, pw) {
    renderLogin();
    if (email != null) $('login-email').value = email;
    if (pw != null) $('login-password').value = pw;
  }

  // Real Google Identity Services
  var gisReady = null, gisInitialised = false;
  function loadGis() {
    if (gisReady) return gisReady;
    gisReady = new Promise(function (resolve, reject) {
      if (window.google && window.google.accounts && window.google.accounts.id) return resolve();
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { gisReady = null; reject(new Error('Could not reach Google. Check your connection.')); };
      document.head.appendChild(s);
    });
    return gisReady;
  }
  function mountGoogleButton() {
    loadGis().then(function () {
      var el = $('gsi-btn'); if (!el) return;
      if (!gisInitialised) {
        var opts = { client_id: CFG.googleClientId, callback: onGoogleCredential, auto_select: false, cancel_on_tap_outside: true, ux_mode: 'popup', context: 'signin' };
        if (CFG.allowedDomain) opts.hd = CFG.allowedDomain;
        window.google.accounts.id.initialize(opts);
        gisInitialised = true;
      }
      var dark = getComputedStyle(document.documentElement).colorScheme === 'dark';
      window.google.accounts.id.renderButton(el, { type: 'standard', theme: dark ? 'filled_black' : 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', logo_alignment: 'center', width: Math.min(400, el.offsetWidth || 360) });
    }).catch(function (err) {
      var el = $('gsi-btn'); if (el) el.innerHTML = '<div class="alert">' + icon('circle-alert') + '<span>' + esc(err.message) + '</span></div>';
      refreshIcons();
    });
  }
  function decodeJwt(token) {
    var part = String(token).split('.')[1] || '';
    var b64 = part.replace(/-/g, '+').replace(/_/g, '/'); while (b64.length % 4) b64 += '=';
    var json = decodeURIComponent(atob(b64).split('').map(function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
    return JSON.parse(json);
  }
  function lowerList(a) { return (a || []).map(function (e) { return String(e).toLowerCase(); }); }
  function onGoogleCredential(resp) {
    ui.loginError = ''; ui.loginLoading = true; renderLogin();
    var claims;
    try { claims = decodeJwt(resp.credential); } catch (e) { return ssoFail('Google returned an unreadable sign-in token.'); }
    if (CFG.apiBaseUrl) {
      // Production path: the backend verifies Google's signature and decides the role.
      fetch(CFG.apiBaseUrl.replace(/\/+$/, '') + '/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: resp.credential }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (body) { return { ok: r.ok, status: r.status, body: body }; }); })
        .then(function (r) {
          if (!r.ok) return ssoFail(typeof r.body.detail === 'string' ? r.body.detail : 'Google sign-in failed (error ' + r.status + ').');
          var u = r.body.user;
          completeSso({ name: u.name, email: u.email, picture: claims.picture }, u.role, r.body.access_token);
        })
        .catch(function () { ssoFail('Could not reach the Perception LMS server. Check apiBaseUrl in js/config.js and the backend CORS settings.'); });
      return;
    }
    // Frontend-only mode (demo): basic claim checks. Not a substitute for server-side verification.
    var now = Date.now() / 1000;
    if (claims.aud !== CFG.googleClientId) return ssoFail('This Google token was issued for a different app.');
    if (['accounts.google.com', 'https://accounts.google.com'].indexOf(claims.iss) === -1) return ssoFail('Sign-in token was not issued by Google.');
    if (claims.exp && claims.exp < now) return ssoFail('Your Google sign-in expired. Please try again.');
    if (!claims.email_verified) return ssoFail('Your Google email address is not verified.');
    if (CFG.allowedDomain && claims.hd !== CFG.allowedDomain) return ssoFail('Sign in with your ' + CFG.allowedDomain + ' account.');
    var email = String(claims.email).toLowerCase();
    var role = lowerList(CFG.adminEmails).indexOf(email) !== -1 ? 'admin' : lowerList(CFG.lecturerEmails).indexOf(email) !== -1 ? 'lecturer' : ui.loginRole;
    completeSso({ name: claims.name || email, email: email, picture: claims.picture }, role, null);
  }
  function ssoFail(msg) { ui.loginLoading = false; ui.loginError = msg; renderLogin(); }
  function completeSso(profile, role, apiToken, simulated) {
    ui.loginLoading = false;
    // Use a matching local account if one exists, otherwise attach the Google identity to the
    // demo workspace for that role so the prototype has data to show.
    var local = state.users.find(function (u) { return u.email.toLowerCase() === String(profile.email).toLowerCase(); });
    if (local && !local.active) return ssoFail('Your account has been deactivated. Contact an administrator.');
    var persona = local || userById(role === 'admin' ? 'u-adm-1' : role === 'lecturer' ? 'u-lec-1' : 'u-stu-1');
    var s = { userId: persona.id, sso: { provider: simulated ? 'google-demo' : 'google', name: profile.name, email: profile.email, picture: profile.picture || null } };
    if (apiToken) s.apiToken = apiToken;
    setSession(s, true);
    toast('Signed in with Google as ' + profile.name);
    go('#/dashboard');
  }
  function googleDemoChooser() {
    var accounts = [['student', 'Alex Morgan', DEMO.student, '#3c886d'], ['lecturer', 'Dr. Maya Chen', DEMO.lecturer, '#b1603b'], ['admin', 'Morgan Ellis', DEMO.admin, '#43658b']];
    openModal({
      title: 'Choose an account', kicker: 'Sign in with Google · demo',
      body: '<p class="muted small">to continue to <strong>Perception LMS</strong></p><div class="list">' + accounts.map(function (a) {
        return '<button type="button" class="list-item" data-action="google-demo-pick" data-role="' + a[0] + '">' + avatar({ name: a[1], color: a[3] }) + '<div class="grow"><div class="title">' + esc(a[1]) + '</div><div class="sub">' + esc(a[2]) + '</div></div><span class="badge gray" style="text-transform:capitalize">' + a[0] + '</span></button>';
      }).join('') + '<button type="button" class="list-item" data-action="google-demo-other"><span class="avatar" style="background:var(--surface-2);color:var(--muted)">' + icon('user-plus') + '</span><div class="grow"><div class="title">Use another account</div><div class="sub">Signs in with the role selected on the sign-in page</div></div></button></div>' +
        '<p class="small muted">This is a simulated Google account picker for presentations. Set <code>googleClientId</code> in <code>js/config.js</code> to use real Google sign-in.</p>',
      foot: null
    });
  }

  // ---------------------------------------------------------------------------
  // App shell
  // ---------------------------------------------------------------------------
  function render() {
    var u = me();
    var r = route();
    if (!u) {
      if (session) clearSession();
      if (r.page !== 'login') { history.replaceState(null, '', '#/login'); }
      renderLogin(); return;
    }
    if (r.page === 'login') { history.replaceState(null, '', '#/dashboard'); r = route(); }
    if (!allowed(u, r.page)) { toast('That page is not available for your role.', 'error'); history.replaceState(null, '', '#/dashboard'); r = route(); }
    var key = r.page + '/' + (r.id || '');
    if (key !== ui.lastRoute) { ui.popover = null; ui.menuOpen = false; }
    var changedRoute = key !== ui.lastRoute; ui.lastRoute = key;

    var page = PAGES[r.page](u, r);
    document.title = page.title + ' · Perception LMS';
    var nav = NAV[u.role].map(function (n) {
      var count = '';
      var active = r.page === n[0];
      return '<a href="#/' + n[0] + '" class="' + (active ? 'active' : '') + '"' + (active ? ' aria-current="page"' : '') + '>' + icon(n[2]) + '<span>' + n[1] + '</span>' + count + '</a>';
    }).join('');

    $('app').innerHTML =
      '<div class="shell">' +
      (ui.menuOpen ? '<div class="shade" data-action="close-menu"></div>' : '') +
      '<aside class="sidebar' + (ui.menuOpen ? ' open' : '') + '" aria-label="Main navigation">' +
      '<div class="brand"><span class="brand-mark" style="background:#2e6a59">' + icon('graduation-cap') + '</span>PERCEPTION</div>' +
      '<div class="nav-label">' + esc(u.role === 'lecturer' ? 'Teaching' : u.role === 'admin' ? 'Administration' : 'Learning') + '</div>' +
      '<nav class="nav">' + nav + '</nav>' +
      '<div class="side-foot"><div class="side-user">' + avatar(u) + '<div style="min-width:0"><div class="name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(u.name) + '</div><div class="role">' + esc(u.role) + '</div></div></div>' +
      '<button type="button" class="btn btn-sm" data-action="logout">' + icon('log-out', 'ic-sm') + 'Sign out</button></div>' +
      '</aside>' +
      '<div class="main"><header class="topbar">' +
      '<button type="button" class="icon-btn menu-btn" data-action="open-menu" aria-label="Open navigation">' + icon('menu') + '</button>' +
      '<div style="min-width:0"><div class="crumbs">' + page.crumbs + '</div><div class="top-title">' + esc(page.title) + '</div></div>' +
      '<div class="top-search">' + icon('search') + '<label for="global-search" class="sr-only">Search modules and lessons</label><input id="global-search" class="field" type="search" placeholder="Search modules, lessons…" autocomplete="off"><div id="search-pop"></div></div>' +
      '<div class="top-actions" style="' + '' + '">' +
      '<button type="button" class="icon-btn" data-action="toggle-theme" aria-label="Switch colour theme">' + icon(isDark() ? 'sun' : 'moon') + '</button>' +
      '<div style="position:relative"><button type="button" class="icon-btn" data-action="toggle-pop" data-pop="user" aria-label="Account menu" aria-expanded="' + (ui.popover === 'user') + '">' + avatar(u, '') + '</button>' + (ui.popover === 'user' ? userPopover(u) : '') + '</div>' +
      '</div></header>' +
      '<main id="view" class="view" tabindex="-1">' + page.html + '</main></div></div>';
    refreshIcons();
    if (page.after) page.after();
    if (changedRoute) { window.scrollTo(0, 0); }
  }
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function crumbs(list) { return list.map(function (c) { return c[1] ? '<a href="' + c[1] + '">' + esc(c[0]) + '</a>' : esc(c[0]); }).join(' / '); }
  function pageHead(kicker, title, sub, actions) {
    return '<div class="page-head reveal"><div><p class="kicker">' + esc(kicker) + '</p><h1 class="serif">' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="head-actions">' + actions + '</div>' : '') + '</div>';
  }
  function stat(label, value, caption, ic, href) {
    var inner = '<span class="ic">' + icon(ic) + '</span><div class="value">' + esc(value) + '</div><div class="label">' + esc(label) + '</div><div class="caption">' + esc(caption) + '</div>';
    return href ? '<a class="panel stat clickable" href="' + href + '" style="text-decoration:none">' + inner + '</a>' : '<div class="panel stat">' + inner + '</div>';
  }
  function empty(ic, text) { return '<div class="empty">' + icon(ic) + '<p>' + esc(text) + '</p></div>'; }

  function userPopover(u) {
    return '<div class="popover" style="width:280px"><div class="popover-head" style="justify-content:flex-start;gap:12px">' + avatar(u) + '<div style="min-width:0"><div>' + esc(u.name) + '</div><div class="small muted" style="font-weight:500;overflow:hidden;text-overflow:ellipsis">' + esc(u.email) + '</div></div></div>' +
      '<button type="button" class="popover-item" data-action="reset-demo">' + icon('rotate-ccw') + 'Reset demo data</button>' +
      '<button type="button" class="popover-item" data-action="toggle-theme">' + icon(isDark() ? 'sun' : 'moon') + (isDark() ? 'Light' : 'Dark') + ' mode</button>' +
      '<button type="button" class="popover-item" data-action="logout" style="color:var(--danger)">' + icon('log-out') + 'Sign out</button></div>';
  }

  function runSearch(q) {
    var box = $('search-pop'); if (!box) return;
    q = q.trim().toLowerCase();
    if (!q) { box.innerHTML = ''; return; }
    var u = me(), results = [];
    coursesFor(u).forEach(function (c) { if ((c.code + ' ' + c.name).toLowerCase().indexOf(q) !== -1) results.push({ icon: 'book-open', title: c.name, sub: c.code + ' · Module', href: '#/modules/' + c.id }); });
    coursesFor(u).forEach(function (c) { visibleModules(u, c).forEach(function (m) { m.lessons.forEach(function (l) { if (l.title.toLowerCase().indexOf(q) !== -1) results.push({ icon: 'circle-play', title: l.title, sub: c.code + ' · ' + m.title, href: '#/modules/' + c.id + '?open=' + m.id }); }); }); });
    results = results.slice(0, 8);
    box.innerHTML = '<div class="popover" style="left:0;right:auto;width:100%;min-width:300px"><div class="popover-list">' + (results.length ? results.map(function (r) { return '<a class="popover-item" href="' + r.href + '">' + icon(r.icon) + '<div style="min-width:0"><div style="font-weight:700">' + esc(r.title) + '</div><div class="small muted">' + esc(r.sub) + '</div></div></a>'; }).join('') : '<div class="popover-empty">No results for “' + esc(q) + '”</div>') + '</div></div>';
    refreshIcons();
  }

  // ---------------------------------------------------------------------------
  // Pages
  // ---------------------------------------------------------------------------
  var PAGES = {};

  // ---- Dashboard -----------------------------------------------------------
  PAGES.dashboard = function (u) {
    var html = u.role === 'student' ? studentDashboard(u) : u.role === 'lecturer' ? lecturerDashboard(u) : adminDashboard(u);
    return { title: 'Dashboard', crumbs: crumbs([['Home']]), html: html };
  };
  function courseCard(u, c) {
    var lect = userById(c.lecturerId), meta;
    if (u.role === 'student') {
      var p = courseProgress(u.id, c);
      meta = '<div class="row between small mt-2"><span class="muted">Progress</span><strong>' + p + '%</strong></div><div class="progress" role="progressbar" aria-valuenow="' + p + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + esc(c.code) + ' progress"><span style="width:' + p + '%"></span></div>';
    } else {
      meta = '<div class="row small muted mt-2 wrap" style="gap:14px"><span class="row" style="gap:6px">' + icon('users', 'ic-sm') + enrolled(c.id).length + ' students</span><span class="row" style="gap:6px">' + icon('layers', 'ic-sm') + c.modules.length + ' modules</span></div>';
    }
    return '<a class="panel course-card reveal" href="#/modules/' + c.id + '"><div class="course-band" style="background:' + esc(c.color) + '"><span class="code">' + esc(c.code) + '</span>' + icon('book-open') + '</div>' +
      '<div class="course-body"><h3 class="serif">' + esc(c.name) + '</h3><p class="small muted">' + esc(lect ? lect.name : 'Lecturer to be assigned') + ' · ' + esc(c.term) + '</p>' + meta +
      '<span class="btn btn-soft btn-sm mt-2" style="align-self:flex-start">Open module ' + icon('arrow-right', 'ic-sm') + '</span></div></a>';
  }
  function lessonCount(c) { return c.modules.reduce(function (t, m) { return t + m.lessons.length; }, 0); }
  function studentDashboard(u) {
    var courses = coursesFor(u);
    var overall = courses.length ? Math.round(courses.reduce(function (t, c) { return t + courseProgress(u.id, c); }, 0) / courses.length) : 0;
    var lessons = [], done = 0;
    courses.forEach(function (c) { allLessons(c).forEach(function (l) { lessons.push(l); if (isDone(u.id, l.id)) done += 1; }); });
    var act = (state.activity[u.id] || [0, 0, 0, 0, 0, 0, 0]), max = Math.max.apply(null, act.concat([60]));
    var days = act.map(function (_, i) { var d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toLocaleString('en-AU', { weekday: 'short' }); });
    var total = act.reduce(function (t, x) { return t + x; }, 0);
    var next = [];
    courses.forEach(function (c) {
      visibleModules(u, c).some(function (m) { return m.lessons.some(function (l) { if (!isDone(u.id, l.id)) { next.push({ c: c, m: m, l: l }); return true; } return false; }); });
    });
    return pageHead(fmtDay(new Date().toISOString()) + ' · Term 4, 2026', greeting() + ', ' + firstName(u.name), 'Here\'s how you\'re going across your modules.', '<a class="btn btn-primary" href="#/modules">' + icon('book-open') + 'My modules</a>') +
      '<div class="grid stats">' +
      stat('Enrolled modules', courses.length, 'This term', 'book-open', '#/modules') +
      stat('Lessons completed', done, 'of ' + lessons.length + ' published', 'circle-check', '#/modules') +
      stat('Overall progress', overall + '%', 'Across all modules', 'trending-up', '#/modules') +
      stat('Study time', Math.round(total / 60 * 10) / 10 + ' h', 'Last 7 days', 'clock') + '</div>' +
      '<div class="grid two-col"><div class="stack">' +
      '<section><div class="panel-head"><h2 class="serif" style="font-size:22px">My modules</h2><a class="btn btn-ghost btn-sm" href="#/modules">View all</a></div><div class="grid cards">' + courses.map(function (c) { return courseCard(u, c); }).join('') + '</div></section>' +
      '</div><div class="stack">' +
      '<section class="panel panel-pad"><div class="panel-head"><h2 class="serif">Continue learning</h2></div><div class="list">' + (next.length ? next.slice(0, 4).map(function (x) {
        return '<div class="list-item"><span class="module-num" style="width:34px;height:34px">' + icon(LESSON_ICON[x.l.type] || 'file', 'ic-sm') + '</span><div class="grow"><div class="title">' + esc(x.l.title) + '</div><div class="sub">' + esc(x.c.code) + ' · ' + esc(x.m.title) + ' · ' + esc(x.l.duration) + '</div></div><button type="button" class="btn btn-soft btn-sm" data-action="open-lesson" data-course="' + x.c.id + '" data-module="' + x.m.id + '" data-lesson="' + x.l.id + '">Open</button></div>';
      }).join('') : empty('party-popper', 'All lessons complete. Great work!')) + '</div></section>' +
      '<section class="panel panel-pad"><div class="panel-head"><div><h2 class="serif">Study activity</h2><p class="small muted">' + Math.round(total / 60 * 10) / 10 + ' hours in the last 7 days</p></div></div>' +
      '<div class="chart" role="img" aria-label="Study minutes per day for the last 7 days: ' + act.join(', ') + '">' + act.map(function (v, i) { return '<div class="col"><div class="bar' + (i === 6 ? ' today' : '') + '" style="height:' + Math.max(4, v / max * 100) + '%"><span class="tip">' + v + ' min</span></div><span class="lbl">' + days[i] + '</span></div>'; }).join('') + '</div></section>' +
      '</div></div>';
  }
  function lecturerDashboard(u) {
    var courses = coursesFor(u);
    var students = {}; courses.forEach(function (c) { enrolled(c.id).forEach(function (s) { students[s] = 1; }); });
    var units = 0, drafts = 0, lessons = 0;
    courses.forEach(function (c) { units += c.modules.length; drafts += c.modules.filter(function (m) { return !m.published; }).length; lessons += lessonCount(c); });
    return pageHead(fmtDay(new Date().toISOString()) + ' · Lecturer', greeting() + ', ' + firstName(u.name), 'You teach <strong>' + courses.length + '</strong> module' + (courses.length === 1 ? '' : 's') + ' this term.', '<a class="btn btn-primary" href="#/modules">' + icon('book-open') + 'My modules</a>') +
      '<div class="grid stats">' + stat('Modules teaching', courses.length, 'This term', 'book-open', '#/modules') + stat('Students', Object.keys(students).length, 'Across your modules', 'users') + stat('Lessons', lessons, units + ' content sections', 'layers') + stat('Drafts', drafts, 'Sections not yet published', 'eye-off') + '</div>' +
      '<div class="grid two-col"><div class="stack">' +
      '<section><div class="panel-head"><h2 class="serif" style="font-size:22px">My modules</h2><a class="btn btn-ghost btn-sm" href="#/modules">View all</a></div><div class="grid cards">' + courses.map(function (c) { return courseCard(u, c); }).join('') + '</div></section>' +
      '</div><div class="stack">' +
      '<section class="panel panel-pad"><div class="panel-head"><h2 class="serif">Add content</h2></div><div class="quick">' +
      courses.map(function (c) { return '<a href="#/modules/' + c.id + '">' + icon('folder-plus') + esc(c.code) + '</a>'; }).join('') + '</div></section>' +
      '<section class="panel panel-pad"><div class="panel-head"><h2 class="serif">Student progress</h2></div>' + courses.map(function (c) {
        var ids = enrolled(c.id), avg = ids.length ? Math.round(ids.reduce(function (t, s) { return t + courseProgress(s, c); }, 0) / ids.length) : 0;
        return '<div class="mt-2"><div class="row between small"><span>' + esc(c.code) + '</span><strong>' + avg + '%</strong></div><div class="progress mt-1"><span style="width:' + avg + '%"></span></div></div>';
      }).join('') + '</section>' +
      '</div></div>';
  }
  function adminDashboard(u) {
    var users = state.users, students = users.filter(function (x) { return x.role === 'student'; });
    var enrolCount = Object.keys(state.enrolments).reduce(function (t, k) { return t + state.enrolments[k].length; }, 0);
    var lessons = state.courses.reduce(function (t, c) { return t + lessonCount(c); }, 0);
    var unassigned = state.courses.filter(function (c) { return !c.lecturerId; }).length;
    return pageHead(fmtDay(new Date().toISOString()) + ' · Administration', greeting() + ', ' + firstName(u.name), 'An overview of every module on Perception LMS.', '<button type="button" class="btn btn-primary" data-action="create-course">' + icon('book-plus') + 'New module</button>') +
      '<div class="grid stats">' + stat('Modules', state.courses.length, 'Term 4 · 2026', 'book-open', '#/modules') + stat('Lessons', lessons, 'Across all modules', 'layers') + stat('Enrolments', enrolCount, students.length + ' students', 'list-checks') + stat('No lecturer', unassigned, 'Modules to assign', 'user-round-x') + '</div>' +
      '<div class="grid two-col"><div class="stack">' +
      '<section class="panel"><div class="panel-pad" style="padding-bottom:6px"><div class="panel-head"><h2 class="serif">Modules overview</h2><a class="btn btn-ghost btn-sm" href="#/modules">All modules</a></div></div><div class="table-wrap"><table><thead><tr><th>Module</th><th class="hide-sm">Lecturer</th><th>Students</th><th class="hide-sm">Content</th></tr></thead><tbody>' +
      state.courses.map(function (c) { var l = userById(c.lecturerId); return '<tr data-href="#/modules/' + c.id + '" style="cursor:pointer"><td><div class="cell-title">' + esc(c.name) + '</div><div class="cell-sub">' + esc(c.code) + '</div></td><td class="hide-sm">' + esc(l ? l.name : '—') + '</td><td>' + enrolled(c.id).length + '</td><td class="hide-sm">' + c.modules.length + ' section' + (c.modules.length === 1 ? '' : 's') + '</td></tr>'; }).join('') +
      '</tbody></table></div></section>' +
      '</div><div class="stack">' +
      '<section class="panel panel-pad"><div class="panel-head"><h2 class="serif">Enrolment by module</h2></div>' + state.courses.map(function (c) {
        var n = enrolled(c.id).length, pct = students.length ? Math.round(n / students.length * 100) : 0;
        return '<div class="mt-2"><div class="row between small"><span>' + esc(c.code) + '</span><strong>' + n + '</strong></div><div class="progress mt-1"><span style="width:' + pct + '%;background:' + esc(c.color) + '"></span></div></div>';
      }).join('') + '</section>' +
      '</div></div>';
  }

  // ---- Modules (courses / subjects) ----------------------------------------
  PAGES.modules = function (u, r) {
    if (r.id) return courseDetail(u, r);
    var q = ui.q.modules.toLowerCase();
    var list = coursesFor(u).filter(function (c) { return !q || (c.code + ' ' + c.name + ' ' + (userById(c.lecturerId) || {}).name).toLowerCase().indexOf(q) !== -1; });
    var title = u.role === 'admin' ? 'All Modules' : 'My Modules';
    return {
      title: title, crumbs: crumbs([['Home', '#/dashboard'], [title]]),
      html: pageHead('Term 4 · 2026', title, u.role === 'student' ? 'The subjects you are enrolled in this term.' : u.role === 'lecturer' ? 'The subjects you teach. Open one to manage its content.' : 'Every subject on the platform.', u.role === 'admin' ? '<button type="button" class="btn btn-primary" data-action="create-course">' + icon('plus') + 'New module</button>' : '') +
        '<div class="toolbar"><div class="input-icon search">' + icon('search') + '<label class="sr-only" for="q-modules">Search modules</label><input id="q-modules" class="field" type="search" data-q="modules" placeholder="Search by code, name or lecturer" value="' + esc(ui.q.modules) + '"></div></div>' +
        (list.length ? '<div class="grid cards">' + list.map(function (c) { return courseCard(u, c); }).join('') + '</div>' : '<div class="panel">' + empty('search-x', 'No modules match your search.') + '</div>')
    };
  };
  var LESSON_ICON = { video: 'circle-play', reading: 'file-text', quiz: 'circle-help', lab: 'flask-conical' };
  function courseDetail(u, r) {
    var c = courseById(r.id);
    if (!c || !canAccessCourse(u, c)) return { title: 'Module not found', crumbs: crumbs([['Home', '#/dashboard'], ['Modules', '#/modules']]), html: '<div class="panel">' + empty('lock', 'This module doesn\'t exist or you don\'t have access to it.') + '<div style="text-align:center;padding-bottom:30px"><a class="btn btn-primary" href="#/modules">Back to modules</a></div></div>' };
    var tab = r.params.get('tab') || 'content';
    var openId = r.params.get('open');
    if (openId && ui.appliedOpen !== location.hash) { ui.openModules[openId] = true; ui.appliedOpen = location.hash; }
    var lect = userById(c.lecturerId), mods = visibleModules(u, c), staff = isStaff(u);
    var canEdit = staff && (u.role === 'admin' || c.lecturerId === u.id);
    var p = courseProgress(u.id, c);
    var tabs = [['content', 'Content', mods.length], ['people', 'People', enrolled(c.id).length + 1]];
    var body;
    if (tab === 'people') body = '<div class="panel panel-pad"><p class="sub-label" style="margin-top:0">Lecturer</p><div class="list-item">' + (lect ? avatar(lect) + '<div class="grow"><div class="title">' + esc(lect.name) + '</div><div class="sub">' + esc(lect.title || 'Lecturer') + '</div></div><a class="btn btn-soft btn-sm" href="mailto:' + esc(lect.email) + '">' + icon('mail', 'ic-sm') + 'Email</a>' : '<span class="muted">Not assigned</span>') + '</div>' +
      '<p class="sub-label">Students (' + enrolled(c.id).length + ')</p><div class="list">' + studentsOf(c.id).map(function (s) { return '<div class="list-item">' + avatar(s) + '<div class="grow"><div class="title">' + esc(s.name) + (s.id === u.id ? ' <span class="badge gray">You</span>' : '') + '</div>' + (staff ? '<div class="sub">' + esc(s.email) + ' · ' + esc(s.studentId || '') + '</div>' : '') + '</div>' + (staff ? '<span class="small muted">' + courseProgress(s.id, c) + '% complete</span>' : '') + '</div>'; }).join('') + '</div></div>';
    else body = (canEdit ? '<div class="row mb-3 wrap"><button type="button" class="btn btn-primary btn-sm" data-action="add-module" data-course="' + c.id + '">' + icon('plus', 'ic-sm') + 'Add module</button><button type="button" class="btn btn-soft btn-sm" data-action="expand-all" data-course="' + c.id + '">' + icon('chevrons-up-down', 'ic-sm') + 'Expand / collapse all</button></div>' : '<div class="row between mb-3"><p class="muted small">' + allLessons(c).filter(function (l) { return isDone(u.id, l.id); }).length + ' of ' + allLessons(c).length + ' lessons complete</p><button type="button" class="btn btn-ghost btn-sm" data-action="expand-all" data-course="' + c.id + '">' + icon('chevrons-up-down', 'ic-sm') + 'Expand / collapse all</button></div>') +
      (mods.length ? mods.map(function (m, i) { return moduleBlock(u, c, m, i, canEdit); }).join('') : '<div class="panel">' + empty('layers', 'No content has been published yet.') + '</div>');

    var nextLesson = null;
    if (u.role === 'student') mods.some(function (m) { return m.lessons.some(function (l) { if (!isDone(u.id, l.id)) { nextLesson = { m: m, l: l }; return true; } return false; }); });
    var side = '<section class="panel panel-pad"><h2 class="serif" style="font-size:18px">About this module</h2><p class="muted mt-1 small">' + esc(c.description) + '</p><div class="list mt-2 small"><div class="list-item"><span class="muted grow">Credits</span><strong>' + c.credits + '</strong></div><div class="list-item"><span class="muted grow">Term</span><strong>' + esc(c.term) + '</strong></div><div class="list-item"><span class="muted grow">Students</span><strong>' + enrolled(c.id).length + '</strong></div></div></section>' +
      (nextLesson ? '<section class="panel panel-pad"><p class="kicker">Up next</p><p style="font-weight:700">' + esc(nextLesson.l.title) + '</p><p class="small muted">' + esc(nextLesson.m.title) + ' · ' + esc(nextLesson.l.duration) + '</p><button type="button" class="btn btn-primary btn-sm mt-2" data-action="open-lesson" data-course="' + c.id + '" data-module="' + nextLesson.m.id + '" data-lesson="' + nextLesson.l.id + '">' + icon('play', 'ic-sm') + 'Continue learning</button></section>' : '') ;

    return {
      title: c.code + ' · ' + c.name, crumbs: crumbs([['Home', '#/dashboard'], [u.role === 'admin' ? 'All Modules' : 'My Modules', '#/modules'], [c.code]]),
      html: '<section class="course-hero reveal" style="background-color:' + esc(c.color) + ';background-image:linear-gradient(135deg,rgba(255,255,255,.06),rgba(0,0,0,.22))"><div class="row between wrap" style="position:relative;z-index:1"><span class="badge" style="background:rgba(255,255,255,.18);color:#fff">' + esc(c.code) + ' · ' + esc(c.term) + '</span>' +
        '<a class="btn btn-light btn-sm" href="#/modules">' + icon('arrow-left', 'ic-sm') + 'All modules</a></div>' +
        '<h1 class="serif" style="position:relative;z-index:1">' + esc(c.name) + '</h1><div class="meta" style="position:relative;z-index:1"><span>' + icon('user-round', 'ic-sm') + esc(lect ? lect.name : 'Lecturer TBA') + '</span><span>' + icon('layers', 'ic-sm') + mods.length + ' modules</span></div>' +
        (u.role === 'student' ? '<div class="hero-progress" style="position:relative;z-index:1"><div class="row between small"><span>Your progress</span><strong>' + p + '%</strong></div><div class="progress mt-1"><span style="width:' + p + '%"></span></div></div>' : '') + '</section>' +
        '<div class="grid two-col"><div><div class="tabs" role="tablist">' + tabs.map(function (t) { return '<a role="tab" class="tab" href="#/modules/' + c.id + '?tab=' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + ' <span class="n">' + t[2] + '</span></a>'; }).join('') + '</div>' + body + '</div><div class="stack">' + side + '</div></div>'
    };
  }
  function moduleBlock(u, c, m, i, canEdit) {
    var open = !!ui.openModules[m.id];
    var done = m.lessons.filter(function (l) { return isDone(u.id, l.id); }).length;
    var right = u.role === 'student' ? (done === m.lessons.length && m.lessons.length ? '<span class="badge">' + icon('circle-check', 'ic-sm') + 'Complete</span>' : '<span class="small muted">' + done + '/' + m.lessons.length + '</span>') : (m.published ? '<span class="badge">Published</span>' : '<span class="badge warn">Draft</span>');
    var lessons = m.lessons.map(function (l) {
      var d = isDone(u.id, l.id);
      return '<div class="lesson' + (d ? ' done' : '') + '"><span class="type-ic">' + icon(LESSON_ICON[l.type] || 'file') + '</span><div class="grow"><div class="lt">' + esc(l.title) + '</div><div class="small muted"><span style="text-transform:capitalize">' + esc(l.type) + '</span> · ' + esc(l.duration) + '</div></div>' +
        '<button type="button" class="btn btn-soft btn-sm" data-action="open-lesson" data-course="' + c.id + '" data-module="' + m.id + '" data-lesson="' + l.id + '">Open</button>' +
        (u.role === 'student' ? '<button type="button" class="tick' + (d ? ' on' : '') + '" data-action="toggle-lesson" data-course="' + c.id + '" data-lesson="' + l.id + '" aria-pressed="' + d + '" aria-label="Mark ' + esc(l.title) + ' as ' + (d ? 'not complete' : 'complete') + '">' + icon('check', 'ic-sm') + '</button>' : '') +
        (canEdit ? '<button type="button" class="icon-btn" style="width:34px;height:34px" data-action="delete-lesson" data-course="' + c.id + '" data-module="' + m.id + '" data-lesson="' + l.id + '" aria-label="Delete lesson ' + esc(l.title) + '">' + icon('trash-2', 'ic-sm') + '</button>' : '') + '</div>';
    }).join('') || '<p class="small muted" style="padding:10px 0">No lessons yet.</p>';
    var mats = m.materials.map(function (f) {
      return '<div class="material">' + fileIcon(f.name) + '<div class="grow" style="min-width:0"><div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis">' + esc(f.name) + '</div><div class="small muted">' + esc(f.size) + '</div></div>' +
        '<button type="button" class="btn btn-soft btn-sm" data-action="download" data-name="' + esc(f.name) + '">' + icon('download', 'ic-sm') + '<span class="hide-sm">Download</span></button>' +
        (canEdit ? '<button type="button" class="icon-btn" style="width:34px;height:34px" data-action="delete-material" data-course="' + c.id + '" data-module="' + m.id + '" data-file="' + f.id + '" aria-label="Delete ' + esc(f.name) + '">' + icon('trash-2', 'ic-sm') + '</button>' : '') + '</div>';
    }).join('');
    return '<article class="module' + (open ? ' open' : '') + (m.published ? '' : ' draft') + '"><button type="button" class="module-head" data-action="toggle-module" data-id="' + m.id + '" aria-expanded="' + open + '">' +
      '<span class="module-num">' + (i + 1) + '</span><div class="grow" style="flex:1;min-width:0"><div style="font-weight:700">' + esc(m.title) + '</div><div class="small muted">' + m.lessons.length + ' lesson' + (m.lessons.length === 1 ? '' : 's') + ' · ' + m.materials.length + ' file' + (m.materials.length === 1 ? '' : 's') + '</div></div>' + right + '<span class="chev">' + icon('chevron-right') + '</span></button>' +
      '<div class="module-body"><p class="sub-label">Lessons</p>' + lessons + (mats ? '<p class="sub-label">Learning materials</p>' + mats : '') +
      (canEdit ? '<div class="row wrap mt-3"><button type="button" class="btn btn-soft btn-sm" data-action="add-lesson" data-course="' + c.id + '" data-module="' + m.id + '">' + icon('plus', 'ic-sm') + 'Lesson</button><button type="button" class="btn btn-soft btn-sm" data-action="upload-material" data-course="' + c.id + '" data-module="' + m.id + '">' + icon('upload', 'ic-sm') + 'Upload file</button><button type="button" class="btn btn-soft btn-sm" data-action="edit-module" data-course="' + c.id + '" data-module="' + m.id + '">' + icon('pencil', 'ic-sm') + 'Rename</button><button type="button" class="btn btn-soft btn-sm" data-action="toggle-publish" data-course="' + c.id + '" data-module="' + m.id + '">' + icon(m.published ? 'eye-off' : 'eye', 'ic-sm') + (m.published ? 'Unpublish' : 'Publish') + '</button><button type="button" class="btn btn-danger btn-sm" data-action="delete-module" data-course="' + c.id + '" data-module="' + m.id + '">' + icon('trash-2', 'ic-sm') + 'Delete</button></div>' : '') +
      '</div></article>';
  }
  function findModule(cId, mId) { var c = courseById(cId); return { c: c, m: c && c.modules.find(function (m) { return m.id === mId; }) }; }
  function lessonModal(cId, mId, lId) {
    var u = me(), x = findModule(cId, mId); if (!x.m) return;
    var lessons = x.m.lessons, idx = lessons.findIndex(function (l) { return l.id === lId; }), l = lessons[idx]; if (!l) return;
    var next = lessons[idx + 1], done = isDone(u.id, l.id), content;
    if (l.type === 'video') content = '<div style="aspect-ratio:16/9;border-radius:14px;background:linear-gradient(135deg,#143f37,#2e6a59);display:grid;place-items:center;color:#fff;text-align:center"><div><span class="ic-lg" style="display:inline-grid;place-items:center;width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.18)">' + icon('play') + '</span><p class="small mt-2" style="opacity:.85">Video lesson · ' + esc(l.duration) + '</p></div></div>';
    else if (l.type === 'quiz') content = '<fieldset style="border:1px solid var(--line);border-radius:12px;padding:14px 16px"><legend class="label" style="padding:0 6px">Which statement best describes machine learning?</legend>' + ['Programs that follow fixed rules written by people', 'Systems that learn patterns from data to make predictions', 'A database that stores large files'].map(function (o, i) { return '<label class="check" style="display:flex;margin-top:10px"><input type="radio" name="quiz" value="' + i + '"> ' + esc(o) + '</label>'; }).join('') + '<button type="button" class="btn btn-soft btn-sm mt-2" data-action="check-quiz">Check answer</button><p id="quiz-result" class="small mt-1" aria-live="polite"></p></fieldset>';
    else content = '<div class="prose"><p>This ' + esc(l.type) + ' introduces the key ideas of <strong>' + esc(l.title) + '</strong>. Work through each section, then use the learning materials for this module to practise.</p><ul><li>Read the overview and the worked example</li><li>Try the practice task (about ' + esc(l.duration) + ')</li><li>Note any questions for your next class</li></ul></div>';
    openModal({
      wide: true, kicker: x.c.code + ' · ' + x.m.title, title: l.title, body: content,
      foot: (u.role === 'student' ? '<button type="button" class="btn ' + (done ? 'btn-soft' : 'btn-primary') + '" data-action="toggle-lesson" data-course="' + cId + '" data-lesson="' + l.id + '" data-from-modal="1">' + icon(done ? 'rotate-ccw' : 'circle-check') + (done ? 'Mark as not complete' : 'Mark as complete') + '</button>' : '') +
        (next ? '<button type="button" class="btn btn-soft" data-action="open-lesson" data-course="' + cId + '" data-module="' + mId + '" data-lesson="' + next.id + '">Next lesson ' + icon('arrow-right') + '</button>' : '<button type="button" class="btn btn-soft" data-action="close-modal">Close</button>')
    });
  }

  // ---- Assignments ---------------------------------------------------------
  function assignmentTable(u, list, compact) {
    if (!list.length) return empty('clipboard-list', 'No assignments here.');
    var student = u.role === 'student';
    return '<div class="table-wrap"><table><thead><tr><th>Assignment</th><th>Due</th>' + (student ? '<th class="hide-sm">Points</th><th>Status</th>' : '<th>Submitted</th><th class="hide-sm">To grade</th>') + '<th><span class="sr-only">Action</span></th></tr></thead><tbody>' +
      list.map(function (a) {
        var c = courseById(a.courseId), cells;
        if (student) {
          var st = studentStatus(a, u.id), s = submissionOf(a.id, u.id);
          cells = '<td class="hide-sm">' + (s && s.grade ? '<strong>' + s.grade.score + '</strong>/' : '') + a.points + '</td><td>' + statusBadge(st) + '</td><td style="text-align:right"><a class="btn ' + (st === 'todo' || st === 'overdue' ? 'btn-primary' : 'btn-soft') + ' btn-sm" href="#/assignments/' + a.id + '">' + (st === 'todo' || st === 'overdue' ? 'Submit' : st === 'graded' ? 'Feedback' : 'View') + '</a></td>';
        } else {
          var subs = submissionsFor(a.id), pend = subs.filter(function (s) { return !s.grade; }).length;
          cells = '<td>' + subs.length + '/' + enrolled(a.courseId).length + '</td><td class="hide-sm">' + (pend ? '<span class="badge warn">' + pend + ' to grade</span>' : '<span class="badge gray">Up to date</span>') + '</td><td style="text-align:right"><a class="btn ' + (pend ? 'btn-primary' : 'btn-soft') + ' btn-sm" href="#/assignments/' + a.id + '">' + (pend ? 'Grade' : 'Open') + '</a></td>';
        }
        var late = new Date(a.due) < new Date();
        return '<tr data-href="#/assignments/' + a.id + '" style="cursor:pointer"><td><div class="cell-title">' + esc(a.title) + '</div>' + (compact ? '' : '<div class="cell-sub">' + esc(c.code) + ' · ' + esc(c.name) + '</div>') + '</td><td><div>' + esc(fmtDay(a.due)) + '</div><div class="cell-sub" style="' + (late ? '' : 'color:var(--accent)') + '">' + esc(relDue(a.due)) + '</div></td>' + cells + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function assignmentDetail(u, r) {
    var a = assignmentById(r.id), c = a && courseById(a.courseId);
    if (!a || !canAccessCourse(u, c) || (u.role === 'student' && !a.published)) return { title: 'Assignment not found', crumbs: crumbs([['Home', '#/dashboard'], ['Assignments', '#/assignments']]), html: '<div class="panel">' + empty('lock', 'This assignment doesn\'t exist or you don\'t have access to it.') + '</div>' };
    var head = '<a class="btn btn-ghost btn-sm mb-3" href="#/assignments">' + icon('arrow-left', 'ic-sm') + 'All assignments</a>' +
      pageHead(c.code + ' · ' + c.name, a.title, '<span class="row wrap" style="gap:14px;display:inline-flex"><span class="row" style="gap:6px">' + icon('calendar', 'ic-sm') + 'Due ' + esc(fmtDay(a.due)) + ', 11:59 pm</span><span class="row" style="gap:6px">' + icon('target', 'ic-sm') + a.points + ' points</span><span class="row" style="gap:6px">' + icon('paperclip', 'ic-sm') + ({ file: 'File upload', text: 'Text entry', both: 'File upload or text entry' }[a.submitType]) + '</span></span>',
        isStaff(u) ? '<button type="button" class="btn btn-soft" data-action="edit-assignment" data-id="' + a.id + '">' + icon('pencil') + 'Edit</button>' : '');
    var instructions = '<section class="panel panel-pad"><h2 class="serif" style="font-size:19px">Instructions</h2><div class="prose mt-2">' + prose(a.instructions) + '</div></section>' +
      (a.rubric && a.rubric.length ? '<section class="panel"><div class="panel-pad" style="padding-bottom:4px"><h2 class="serif" style="font-size:19px">Marking rubric</h2></div><div class="table-wrap"><table class="rubric"><thead><tr><th>Criterion</th><th>Points</th></tr></thead><tbody>' + a.rubric.map(function (x) { return '<tr><td>' + esc(x[0]) + '</td><td>' + x[1] + '</td></tr>'; }).join('') + '<tr><td><strong>Total</strong></td><td><strong>' + a.points + '</strong></td></tr></tbody></table></div></section>' : '');
    if (u.role === 'student') {
      return { title: a.title, crumbs: crumbs([['Home', '#/dashboard'], ['Assignments', '#/assignments'], [c.code]]), html: head + '<div class="grid two-col"><div class="stack">' + instructions + '</div><div class="stack">' + submissionPanel(u, a) + '</div></div>' };
    }
    var subs = submissionsFor(a.id), studs = studentsOf(a.courseId), graded = subs.filter(function (s) { return s.grade; });
    var avg = graded.length ? Math.round(graded.reduce(function (t, s) { return t + s.grade.score; }, 0) / graded.length / a.points * 100) : null;
    var rows = studs.map(function (s) {
      var sub = submissionOf(a.id, s.id), late = sub && new Date(sub.submittedAt) > new Date(a.due);
      return '<tr><td><div class="row">' + avatar(s) + '<div><div class="cell-title">' + esc(s.name) + '</div><div class="cell-sub">' + esc(s.studentId || s.email) + '</div></div></div></td>' +
        '<td>' + (sub ? esc(fmtTime(sub.submittedAt)) + (late ? ' <span class="badge danger">Late</span>' : '') : '<span class="badge ' + (new Date(a.due) < new Date() ? 'danger' : 'gray') + '">Not submitted</span>') + '</td>' +
        '<td class="hide-sm">' + (sub ? (sub.files.map(function (f) { return '<button type="button" class="btn btn-ghost btn-sm" data-action="download" data-name="' + esc(f.name) + '">' + icon('paperclip', 'ic-sm') + esc(f.name) + '</button>'; }).join('') + (sub.text ? '<span class="small muted">Text entry</span>' : '')) : '—') + '</td>' +
        '<td>' + (sub && sub.grade ? '<strong>' + sub.grade.score + '</strong>/' + a.points : sub ? '<span class="badge warn">Needs grading</span>' : '—') + '</td>' +
        '<td style="text-align:right">' + (sub ? '<button type="button" class="btn ' + (sub.grade ? 'btn-soft' : 'btn-primary') + ' btn-sm" data-action="grade" data-assignment="' + a.id + '" data-student="' + s.id + '">' + (sub.grade ? 'Edit grade' : 'Grade') + '</button>' : '') + '</td></tr>';
    }).join('');
    return {
      title: a.title, crumbs: crumbs([['Home', '#/dashboard'], ['Assignments', '#/assignments'], [c.code]]),
      html: head + '<div class="grid stats">' + stat('Submitted', subs.length + '/' + studs.length, 'Students', 'inbox') + stat('Graded', graded.length, (subs.length - graded.length) + ' waiting', 'circle-check') + stat('Average', avg == null ? '—' : avg + '%', 'Of graded work', 'chart-no-axes-column') + stat('Deadline', relDue(a.due).replace('Due ', ''), fmtDay(a.due), 'clock') + '</div>' +
        '<section class="panel mb-3"><div class="panel-pad" style="padding-bottom:6px"><div class="panel-head"><h2 class="serif">Submissions</h2></div></div><div class="table-wrap"><table><thead><tr><th>Student</th><th>Submitted</th><th class="hide-sm">Work</th><th>Grade</th><th><span class="sr-only">Action</span></th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">' + empty('users', 'No students enrolled.') + '</td></tr>') + '</tbody></table></div></section>' +
        '<div class="grid two-col"><div class="stack">' + instructions + '</div></div>'
    };
  }
  function submissionPanel(u, a) {
    var s = submissionOf(a.id, u.id), ms = new Date(a.due) - new Date(), d = dayDiff(a.due);
    var cd = '<div class="countdown ' + (ms < 0 ? 'late' : d <= 2 ? 'soon' : '') + '">' + icon(ms < 0 ? 'triangle-alert' : 'clock') + '<div><strong>' + esc(relDue(a.due)) + '</strong><div class="small">' + esc(fmtDay(a.due)) + ' at 11:59 pm</div></div></div>';
    if (s && s.grade) {
      var pct = Math.round(s.grade.score / a.points * 100);
      return '<section class="panel panel-pad"><div class="row" style="gap:18px"><div class="score-ring" style="background:conic-gradient(var(--forest) ' + pct + '%, var(--surface-2) 0)"><div class="inner">' + pct + '%</div></div><div><p class="kicker" style="margin:0">Graded</p><p class="serif" style="font-size:24px">' + s.grade.score + ' / ' + a.points + '</p><p class="small muted">Released ' + esc(fmtTime(s.grade.gradedAt)) + '</p></div></div>' +
        '<p class="sub-label">Lecturer feedback</p><div class="feedback">' + prose(s.grade.feedback) + '<p class="small muted mt-1">— ' + esc((userById(s.grade.gradedBy) || {}).name || 'Lecturer') + '</p></div>' + submittedSummary(s) + '</section>';
    }
    if (s && !ui.resubmit[a.id]) {
      return '<section class="panel panel-pad">' + cd + '<div class="row mt-3"><span class="success-ic" style="width:44px;height:44px;margin:0">' + icon('circle-check') + '</span><div><p style="font-weight:700">Submitted</p><p class="small muted">' + esc(fmtTime(s.submittedAt)) + ' · awaiting grading</p></div></div>' + submittedSummary(s) +
        (ms > 0 ? '<button type="button" class="btn btn-soft btn-block mt-3" data-action="resubmit" data-id="' + a.id + '">' + icon('rotate-ccw') + 'Resubmit</button><p class="small muted mt-1">You can resubmit until the due date. Your latest submission will be marked.</p>' : '') + '</section>';
    }
    if (ui.pending.id !== a.id) ui.pending = { id: a.id, files: [] };
    var files = ui.pending.files;
    return '<section class="panel panel-pad">' + cd + '<h2 class="serif mt-3" style="font-size:19px">' + (s ? 'Resubmit your work' : 'Your submission') + '</h2>' +
      (ms < 0 ? '<p class="small mt-1" style="color:var(--danger)">The due date has passed. Your submission will be marked as late.</p>' : '') +
      (a.submitType !== 'text' ? '<div class="mt-2"><p class="label">Upload files</p><div class="dropzone mt-1" data-action="pick-files" data-drop="' + a.id + '" role="button" tabindex="0" aria-label="Choose files to upload">' + icon('cloud-upload') + '<p style="font-weight:700;margin-top:6px">Drag files here or <span style="color:var(--forest);text-decoration:underline">browse</span></p><p class="small muted">PDF, Word, PowerPoint, Excel, ZIP, images or code · max 20 MB each</p></div><input type="file" id="file-input" multiple hidden data-change="files">' +
        '<div id="file-list">' + files.map(function (f, i) { return '<div class="file-chip">' + fileIcon(f.name) + '<span class="grow">' + esc(f.name) + '</span><span class="small muted">' + esc(f.size) + '</span><button type="button" class="icon-btn" style="width:30px;height:30px" data-action="remove-file" data-idx="' + i + '" aria-label="Remove ' + esc(f.name) + '">' + icon('x', 'ic-sm') + '</button></div>'; }).join('') + '</div></div>' : '') +
      (a.submitType !== 'file' ? '<div class="field-group mt-3"><label for="draft-text">' + (a.submitType === 'both' ? 'Or write your answer' : 'Your answer') + '</label><textarea id="draft-text" class="field" data-draft="' + a.id + '" placeholder="Type or paste your work here…" style="min-height:160px">' + esc(ui.drafts[a.id] || '') + '</textarea><span class="small muted" id="word-count">' + wordCount(ui.drafts[a.id]) + ' words</span></div>' : '') +
      '<label class="check mt-3" style="align-items:flex-start"><input type="checkbox" id="own-work" data-own="' + a.id + '"' + (ui.confirmOwn[a.id] ? ' checked' : '') + ' style="margin-top:3px"> <span class="small">I confirm this is my own work and I have acknowledged all sources, in line with the ASA College academic integrity policy.</span></label>' +
      '<p id="submit-error" class="alert mt-2" hidden></p>' +
      '<div class="row mt-3">' + (s ? '<button type="button" class="btn btn-soft" data-action="cancel-resubmit" data-id="' + a.id + '">Cancel</button>' : '') + '<button type="button" class="btn btn-primary" style="flex:1" data-action="submit-assignment" data-id="' + a.id + '">' + icon('send') + (s ? 'Resubmit assignment' : 'Submit assignment') + '</button></div></section>';
  }
  function wordCount(t) { t = String(t || '').trim(); return t ? t.split(/\s+/).length : 0; }
  function submittedSummary(s) {
    return '<p class="sub-label">Your submission</p>' + s.files.map(function (f) { return '<div class="file-chip">' + fileIcon(f.name) + '<span class="grow">' + esc(f.name) + '</span><button type="button" class="btn btn-ghost btn-sm" data-action="download" data-name="' + esc(f.name) + '">' + icon('download', 'ic-sm') + '</button></div>'; }).join('') +
      (s.text ? '<div class="feedback small mt-1" style="border-left-color:var(--line-strong)">' + esc(s.text.length > 220 ? s.text.slice(0, 220) + '…' : s.text) + '</div>' : '') +
      '<p class="small muted mt-2">Receipt <span class="receipt">' + esc(s.receipt) + '</span></p>';
  }
  var ALLOWED = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'zip', 'png', 'jpg', 'jpeg', 'txt', 'ipynb', 'py', 'html', 'css', 'js'];
  function addFiles(fileList) {
    var errors = [];
    Array.prototype.forEach.call(fileList, function (f) {
      var ext = f.name.split('.').pop().toLowerCase();
      if (ALLOWED.indexOf(ext) === -1) errors.push(f.name + ': file type not accepted');
      else if (f.size > 20 * 1048576) errors.push(f.name + ': larger than 20 MB');
      else if (ui.pending.files.some(function (x) { return x.name === f.name; })) errors.push(f.name + ': already added');
      else ui.pending.files.push({ name: f.name, size: fmtSize(f.size) });
    });
    if (errors.length) toast(errors.join(' · '), 'error');
    else if (fileList.length) toast(fileList.length + ' file' + (fileList.length === 1 ? '' : 's') + ' ready to submit');
    render();
  }
  function submitAssignment(id) {
    var u = me(), a = assignmentById(id), err = $('submit-error');
    var text = String(ui.drafts[id] || '').trim(), files = ui.pending.id === id ? ui.pending.files : [];
    function fail(msg) { err.hidden = false; err.innerHTML = icon('circle-alert') + '<span>' + esc(msg) + '</span>'; refreshIcons(); err.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    if (a.submitType === 'file' && !files.length) return fail('Add at least one file to submit.');
    if (a.submitType === 'text' && !text) return fail('Write your answer before submitting.');
    if (a.submitType === 'both' && !files.length && !text) return fail('Upload a file or write your answer before submitting.');
    if (!ui.confirmOwn[id]) return fail('Please confirm the academic integrity statement.');
    var late = new Date(a.due) < new Date();
    openModal({
      title: 'Submit assignment?', kicker: courseById(a.courseId).code,
      body: '<p>You are submitting <strong>' + esc(a.title) + '</strong>' + (files.length ? ' with ' + files.length + ' file' + (files.length === 1 ? '' : 's') : '') + (text ? (files.length ? ' and' : ' with') + ' a ' + wordCount(text) + '-word text entry' : '') + '.</p>' + (late ? '<p class="alert">' + icon('triangle-alert') + '<span>This submission is after the due date and will be marked late.</span></p>' : '') + '<p class="small muted">You can resubmit until the due date.</p>',
      submitLabel: 'Submit now',
      onSubmit: function (_, form) {
        var btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Uploading…';
        wait(900).then(function () {
          var existing = submissionOf(id, u.id), rec = receipt();
          var sub = { id: existing ? existing.id : uid('s'), assignmentId: id, studentId: u.id, submittedAt: new Date().toISOString(), files: files.slice(), text: text, receipt: rec, grade: null };
          if (existing) state.submissions[state.submissions.indexOf(existing)] = sub; else state.submissions.push(sub);
          save();
          ui.pending = { id: null, files: [] }; ui.drafts[id] = ''; ui.confirmOwn[id] = false; ui.resubmit[id] = false;
          openModal({
            title: 'Submission received', body: '<div style="text-align:center"><span class="success-ic">' + icon('circle-check') + '</span><p class="mt-2"><strong>' + esc(a.title) + '</strong> was submitted on ' + esc(fmtTime(sub.submittedAt)) + '.</p><p class="mt-2">Receipt number <span class="receipt">' + esc(rec) + '</span></p><p class="small muted mt-2">A confirmation email would be sent to ' + esc(u.email) + '.</p></div>',
            foot: '<a class="btn btn-soft" href="#/assignments" data-action="close-modal">Back to assignments</a><button type="button" class="btn btn-primary" data-action="close-modal">Done</button>'
          });
          render();
        });
      }
    });
  }
  function gradeModal(aId, sId) {
    var a = assignmentById(aId), s = submissionOf(aId, sId), st = userById(sId); if (!a || !s) return;
    openModal({
      wide: true, kicker: courseById(a.courseId).code + ' · ' + a.title, title: 'Grade ' + st.name,
      body: '<div class="row small muted">' + icon('clock', 'ic-sm') + 'Submitted ' + esc(fmtTime(s.submittedAt)) + (new Date(s.submittedAt) > new Date(a.due) ? ' <span class="badge danger">Late</span>' : '') + ' · Receipt <span class="receipt">' + esc(s.receipt) + '</span></div>' +
        (s.files.length ? '<div>' + s.files.map(function (f) { return '<div class="file-chip">' + fileIcon(f.name) + '<span class="grow">' + esc(f.name) + '</span><span class="small muted">' + esc(f.size) + '</span><button type="button" class="btn btn-ghost btn-sm" data-action="download" data-name="' + esc(f.name) + '">' + icon('download', 'ic-sm') + 'Download</button></div>'; }).join('') + '</div>' : '') +
        (s.text ? '<div class="feedback small" style="border-left-color:var(--line-strong);max-height:160px;overflow:auto">' + esc(s.text) + '</div>' : '') +
        '<div class="form-grid">' + field('score', 'Score (out of ' + a.points + ')', s.grade ? s.grade.score : '', { type: 'number', min: 0, max: a.points, required: true }) + '<div class="field-group"><span class="label">Rubric</span><span class="small muted">' + (a.rubric || []).map(function (x) { return esc(x[0]) + ' (' + x[1] + ')'; }).join(' · ') + '</span></div>' +
        field('feedback', 'Feedback for the student', s.grade ? s.grade.feedback : '', { type: 'textarea', full: true, required: true, placeholder: 'What went well, and what would improve this work?' }) + '</div>',
      submitLabel: s.grade ? 'Update grade' : 'Release grade',
      onSubmit: function (d) {
        var score = Number(d.score);
        if (d.score === '' || isNaN(score) || score < 0 || score > a.points) return modalError('Enter a score between 0 and ' + a.points + '.');
        if (!String(d.feedback).trim()) return modalError('Add feedback so the student knows how to improve.');
        s.grade = { score: Math.round(score * 10) / 10, feedback: String(d.feedback).trim(), gradedAt: new Date().toISOString(), gradedBy: me().id };
        save(); closeModal(); toast('Grade released to ' + st.name); render();
      }
    });
  }
  function assignmentForm(a, presetCourse) {
    var u = me(), courses = coursesFor(u);
    if (!courses.length) return toast('You have no modules to add assignments to.', 'error');
    function localDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    var dueVal = a ? localDate(new Date(a.due)) : (function () { var d = new Date(); d.setDate(d.getDate() + 7); return localDate(d); })();
    openModal({
      wide: true, title: a ? 'Edit assignment' : 'New assignment', kicker: 'Assessment',
      body: '<div class="form-grid">' + field('title', 'Title', a ? a.title : '', { required: true, full: true, placeholder: 'e.g. Week 4 Case Study' }) +
        field('courseId', 'Module', a ? a.courseId : (presetCourse || courses[0].id), { type: 'select', options: courses.map(function (c) { return [c.id, c.code + ' · ' + c.name]; }) }) +
        field('due', 'Due date', dueVal, { type: 'date', required: true }) +
        field('points', 'Points', a ? a.points : 100, { type: 'number', min: 1, max: 1000, required: true }) +
        field('submitType', 'Submission type', a ? a.submitType : 'both', { type: 'select', options: [['both', 'File upload or text'], ['file', 'File upload only'], ['text', 'Text entry only']] }) +
        field('instructions', 'Instructions', a ? a.instructions : '', { type: 'textarea', full: true, required: true, placeholder: 'Describe the task. Start lines with "- " to make a list.' }) + '</div>' +
        '<label class="check"><input type="checkbox" name="published"' + (!a || a.published ? ' checked' : '') + '> Visible to students</label>',
      submitLabel: a ? 'Save changes' : 'Create assignment',
      onSubmit: function (d) {
        if (!String(d.title).trim()) return modalError('Give the assignment a title.');
        if (!d.due) return modalError('Choose a due date.');
        var pts = Number(d.points); if (!(pts > 0)) return modalError('Points must be more than 0.');
        if (!String(d.instructions).trim()) return modalError('Add instructions for students.');
        var due = new Date(d.due + 'T23:59:00');
        var rec = a || { id: uid('a'), rubric: [['Overall quality', pts]] };
        Object.assign(rec, { title: String(d.title).trim(), courseId: d.courseId, due: due.toISOString(), points: pts, submitType: d.submitType, instructions: String(d.instructions).trim(), published: d.published === 'on' });
        if (!a) state.assignments.push(rec);
        else if (rec.rubric && rec.rubric.length === 1) rec.rubric = [['Overall quality', pts]];
        save(); closeModal(); toast(a ? 'Assignment updated' : 'Assignment created and ' + (rec.published ? 'published to students' : 'saved as hidden'));
        if (!a) go('#/assignments/' + rec.id); else render();
      }
    });
  }

  // ---- Grades / gradebook --------------------------------------------------

  // ---- Announcements -------------------------------------------------------
  function announcementCard(u, n) {
    var c = n.courseId ? courseById(n.courseId) : null, author = userById(n.authorId) || { name: 'Staff' };
    var canDelete = u.role === 'admin' || n.authorId === u.id;
    return '<article class="panel announcement reveal"><div class="row between wrap"><div class="row">' + avatar(author) + '<div><div style="font-weight:700">' + esc(author.name) + '</div><div class="small muted">' + esc(ago(n.date)) + ' · ' + esc(fmtTime(n.date)) + '</div></div></div><div class="row">' + (n.pinned ? '<span class="badge warn">' + icon('pin', 'ic-sm') + 'Pinned</span>' : '') + '<span class="badge ' + (c ? '' : 'info') + '">' + esc(c ? c.code : 'All students') + '</span>' +
      (canDelete ? '<button type="button" class="icon-btn" style="width:34px;height:34px" data-action="delete-announcement" data-id="' + n.id + '" aria-label="Delete announcement">' + icon('trash-2', 'ic-sm') + '</button>' : '') + '</div></div>' +
      '<h2 class="serif mt-2" style="font-size:20px">' + esc(n.title) + '</h2><div class="body prose">' + prose(n.body) + '</div></article>';
  }
  function announcementForm(presetCourse) {
    var u = me(), opts = coursesFor(u).map(function (c) { return [c.id, c.code + ' · ' + c.name]; });
    if (u.role === 'admin') opts.unshift(['', 'All students (college-wide)']);
    if (!opts.length) return toast('You have no modules to post to.', 'error');
    openModal({
      title: 'New announcement', kicker: 'Announcements',
      body: field('courseId', 'Send to', presetCourse || opts[0][0], { type: 'select', options: opts }) + field('title', 'Title', '', { required: true, placeholder: 'e.g. Class moved to Room 3.10' }) + field('body', 'Message', '', { type: 'textarea', required: true }) + '<label class="check"><input type="checkbox" name="pinned"> Pin to the top</label>',
      submitLabel: 'Post announcement',
      onSubmit: function (d) {
        if (!String(d.title).trim()) return modalError('Add a title.');
        if (!String(d.body).trim()) return modalError('Write a message.');
        state.announcements.push({ id: uid('n'), courseId: d.courseId || null, title: String(d.title).trim(), body: String(d.body).trim(), date: new Date().toISOString(), authorId: u.id, pinned: d.pinned === 'on' });
        save(); closeModal();
        var n = d.courseId ? enrolled(d.courseId).length : state.users.filter(function (x) { return x.role === 'student'; }).length;
        toast('Announcement posted to ' + n + ' student' + (n === 1 ? '' : 's')); render();
      }
    });
  }

  // ---- Admin: users --------------------------------------------------------
  function userForm(x) {
    openModal({
      title: x ? 'Edit user' : 'Add user', kicker: 'Users',
      body: '<div class="form-grid">' + field('name', 'Full name', x ? x.name : '', { required: true, full: true }) + field('email', 'Email', x ? x.email : '', { type: 'email', required: true, full: true, hint: 'They sign in with Google using this address.' }) +
        field('role', 'Role', x ? x.role : 'student', { type: 'select', options: [['student', 'Student'], ['lecturer', 'Lecturer'], ['admin', 'Admin']] }) + field('extra', 'Student ID / title', x ? (x.studentId || x.title || '') : '', { placeholder: 'Optional' }) + '</div>',
      submitLabel: x ? 'Save changes' : 'Add user',
      onSubmit: function (d) {
        var email = String(d.email).trim().toLowerCase();
        if (!String(d.name).trim()) return modalError('Enter a name.');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return modalError('Enter a valid email address.');
        if (state.users.some(function (y) { return y.email.toLowerCase() === email && (!x || y.id !== x.id); })) return modalError('A user with that email already exists.');
        if (x && x.id === me().id && d.role !== 'admin') return modalError('You can\'t remove your own admin role.');
        var rec = x || { id: uid('u'), active: true, color: ['#3c886d', '#2f7d8c', '#8a5a2b', '#7b4f9d', '#43658b', '#b1603b'][state.users.length % 6] };
        rec.name = String(d.name).trim(); rec.email = email; rec.role = d.role;
        if (d.role === 'student') { rec.studentId = String(d.extra).trim() || rec.studentId || 'ASA-2026-' + (1000 + state.users.length); delete rec.title; } else { rec.title = String(d.extra).trim(); }
        if (!x) state.users.push(rec);
        save(); closeModal(); toast(x ? 'User updated' : rec.name + ' added as ' + rec.role); render();
      }
    });
  }

  // ---- Admin: enrolments ---------------------------------------------------
  function courseForm() {
    var lecturers = state.users.filter(function (x) { return x.role === 'lecturer' && x.active; });
    openModal({
      title: 'New module', kicker: 'Modules',
      body: '<div class="form-grid">' + field('code', 'Code', '', { required: true, placeholder: 'e.g. MKT150', maxlength: 20 }) + field('term', 'Term', 'Term 4 · 2026', { required: true }) + field('name', 'Module name', '', { required: true, full: true, placeholder: 'e.g. Digital Marketing' }) +
        field('lecturerId', 'Lecturer', lecturers[0] ? lecturers[0].id : '', { type: 'select', options: [['', '— Not assigned —']].concat(lecturers.map(function (l) { return [l.id, l.name]; })) }) +
        field('color', 'Colour', '#17483f', { type: 'select', options: [['#17483f', 'Forest'], ['#2f5f8a', 'Ocean'], ['#7a4a2a', 'Clay'], ['#5a3d6e', 'Plum'], ['#6b5a1e', 'Olive']] }) +
        field('description', 'Description', '', { type: 'textarea', full: true }) + '</div>',
      submitLabel: 'Create module',
      onSubmit: function (d) {
        var code = String(d.code).trim().toUpperCase();
        if (!code || !String(d.name).trim()) return modalError('Enter a code and a name.');
        if (state.courses.some(function (c) { return c.code === code; })) return modalError('A module with code ' + code + ' already exists.');
        var c = { id: uid('c'), code: code, name: String(d.name).trim(), lecturerId: d.lecturerId || null, term: String(d.term).trim(), credits: 10, color: d.color, description: String(d.description).trim() || 'No description yet.', modules: [] };
        state.courses.push(c); state.enrolments[c.id] = []; ui.enrolCourse = c.id;
        save(); closeModal(); toast(code + ' created'); render();
      }
    });
  }
  function addStudentsForm(cId) {
    var c = courseById(cId), avail = state.users.filter(function (x) { return x.role === 'student' && x.active && enrolled(cId).indexOf(x.id) === -1; });
    openModal({
      title: 'Enrol students', kicker: c.code + ' · ' + c.name,
      body: avail.length ? '<div class="list">' + avail.map(function (s) { return '<label class="list-item" style="cursor:pointer"><input type="checkbox" name="s_' + s.id + '" style="width:18px;height:18px;accent-color:var(--forest)">' + avatar(s) + '<div class="grow"><div class="title">' + esc(s.name) + '</div><div class="sub">' + esc(s.email) + '</div></div></label>'; }).join('') + '</div>' : '<p class="muted">Every active student is already enrolled. Add new students on the Users page.</p>',
      submitLabel: 'Enrol selected', foot: avail.length ? undefined : '<button type="button" class="btn btn-primary" data-action="close-modal">OK</button>',
      onSubmit: function (d) {
        var ids = Object.keys(d).filter(function (k) { return k.indexOf('s_') === 0; }).map(function (k) { return k.slice(2); });
        if (!ids.length) return modalError('Select at least one student.');
        state.enrolments[cId] = enrolled(cId).concat(ids); save(); closeModal();
        toast(ids.length + ' student' + (ids.length === 1 ? '' : 's') + ' enrolled in ' + c.code); render();
      }
    });
  }

  // ---- Profile -------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function setTheme(t) {
    if (t === 'system') { document.documentElement.removeAttribute('data-theme'); safeRemove('localStorage', THEME_KEY); }
    else { document.documentElement.setAttribute('data-theme', t); safeSet('localStorage', THEME_KEY, t); }
  }
  function download(name) {
    var blob = new Blob(['Perception LMS — demo file\n\nThis is a placeholder for "' + name + '".\nIn the live system, this downloads the real file from secure storage.\n'], { type: 'text/plain' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name.replace(/\.[^.]+$/, '') + ' (demo).txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('Downloading ' + name);
  }
  function logout() {
    if (window.google && window.google.accounts && window.google.accounts.id) { try { window.google.accounts.id.disableAutoSelect(); } catch (e) { /* ignore */ } }
    clearSession(); ui.loginError = ''; ui.popover = null; closeModal();
    location.hash = '#/login'; render(); toast('You have signed out.');
  }

  var ACTIONS = {
    'close-modal': closeModal,
    'pick-role': function (el) { ui.loginRole = el.dataset.role; ui.loginError = ''; var e = $('login-email') && $('login-email').value; renderLogin(); if (e) $('login-email').value = e; },
    'fill-demo': function () { var u = state.users.find(function (x) { return x.email === DEMO[ui.loginRole]; }); renderLogin(); $('login-email').value = u.email; $('login-password').value = u.password; $('login-password').focus(); },
    'toggle-password': function () { var e = $('login-email').value, p = $('login-password').value; ui.showPassword = !ui.showPassword; renderLogin(); $('login-email').value = e; $('login-password').value = p; $('login-password').focus(); },
    'forgot-password': function () {
      openModal({ title: 'Reset your password', kicker: 'Account help', body: '<p class="muted small">Enter your college email and we\'ll send you a reset link. Signed in with Google? Reset your password through your Google account.</p>' + field('email', 'Email', ($('login-email') || {}).value || '', { type: 'email', required: true }), submitLabel: 'Send reset link',
        onSubmit: function (d) { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.email).trim())) return modalError('Enter a valid email address.'); closeModal(); toast('If an account exists for ' + String(d.email).trim() + ', a reset link is on its way.'); } });
    },
    'google-demo': googleDemoChooser,
    'google-demo-pick': function (el) {
      var u = state.users.find(function (x) { return x.email === DEMO[el.dataset.role]; });
      closeModal(); ui.loginLoading = true; renderLogin();
      wait(600).then(function () { completeSso({ name: u.name, email: u.email }, u.role, null, true); });
    },
    'google-demo-other': function () {
      openModal({ title: 'Sign in with Google', kicker: 'Demo', body: field('name', 'Your name', '', { required: true }) + field('email', 'Google email', '', { type: 'email', required: true }) + '<p class="small muted">You will sign in as a <strong>' + esc(ui.loginRole) + '</strong> (the role selected on the sign-in page).</p>', submitLabel: 'Continue',
        onSubmit: function (d) {
          var email = String(d.email).trim().toLowerCase();
          if (!String(d.name).trim()) return modalError('Enter your name.');
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return modalError('Enter a valid email address.');
          if (CFG.allowedDomain && email.split('@')[1] !== CFG.allowedDomain) return modalError('Sign in with your ' + CFG.allowedDomain + ' account.');
          closeModal(); completeSso({ name: String(d.name).trim(), email: email }, ui.loginRole, null, true);
        } });
    },
    'logout': logout,
    'open-menu': function () { ui.menuOpen = true; render(); },
    'close-menu': function () { ui.menuOpen = false; render(); },
    'toggle-pop': function (el) { ui.popover = ui.popover === el.dataset.pop ? null : el.dataset.pop; render(); },
    'toggle-theme': function () { setTheme(isDark() ? 'light' : 'dark'); render(); },
    'toggle-module': function (el) { ui.openModules[el.dataset.id] = !ui.openModules[el.dataset.id]; render(); },
    'expand-all': function (el) {
      var c = courseById(el.dataset.course), anyClosed = c.modules.some(function (m) { return !ui.openModules[m.id]; });
      c.modules.forEach(function (m) { ui.openModules[m.id] = anyClosed; }); render();
    },
    'toggle-lesson': function (el) {
      var u = me(); state.progress[u.id] = state.progress[u.id] || {};
      var on = !state.progress[u.id][el.dataset.lesson];
      if (on) state.progress[u.id][el.dataset.lesson] = true; else delete state.progress[u.id][el.dataset.lesson];
      if (on && state.activity[u.id]) state.activity[u.id][6] += 15;
      save();
      var c = courseById(el.dataset.course);
      if (el.dataset.fromModal) closeModal();
      toast(on ? 'Lesson complete · ' + c.code + ' is now ' + courseProgress(u.id, c) + '% done' : 'Marked as not complete');
      render();
    },
    'open-lesson': function (el) { lessonModal(el.dataset.course, el.dataset.module, el.dataset.lesson); },
    'check-quiz': function () {
      var pick = document.querySelector('input[name=quiz]:checked'), out = $('quiz-result');
      if (!pick) { out.textContent = 'Choose an answer first.'; return; }
      out.textContent = pick.value === '1' ? '✓ Correct — machine learning finds patterns in data.' : '✗ Not quite. Try again.';
      out.style.color = pick.value === '1' ? 'var(--forest)' : 'var(--danger)';
    },
    'download': function (el) { download(el.dataset.name); },
    'add-module': function (el) {
      openModal({ title: 'Add module', kicker: courseById(el.dataset.course).code, body: field('title', 'Module title', '', { required: true, placeholder: 'e.g. Week 5: Neural Networks' }) + '<label class="check"><input type="checkbox" name="published"> Publish now (visible to students)</label>', submitLabel: 'Add module',
        onSubmit: function (d) {
          if (!String(d.title).trim()) return modalError('Enter a title.');
          var m = { id: uid('m'), title: String(d.title).trim(), published: d.published === 'on', lessons: [], materials: [] };
          courseById(el.dataset.course).modules.push(m); ui.openModules[m.id] = true; save(); closeModal(); toast('Module added' + (m.published ? ' and published' : ' as a draft')); render();
        } });
    },
    'edit-module': function (el) {
      var x = findModule(el.dataset.course, el.dataset.module);
      openModal({ title: 'Rename module', kicker: x.c.code, body: field('title', 'Module title', x.m.title, { required: true }), onSubmit: function (d) { if (!String(d.title).trim()) return modalError('Enter a title.'); x.m.title = String(d.title).trim(); save(); closeModal(); toast('Module renamed'); render(); } });
    },
    'toggle-publish': function (el) { var x = findModule(el.dataset.course, el.dataset.module); x.m.published = !x.m.published; save(); toast(x.m.title + (x.m.published ? ' is now visible to students' : ' is hidden from students')); render(); },
    'delete-module': function (el) {
      var x = findModule(el.dataset.course, el.dataset.module);
      confirmModal('Delete module?', '“' + x.m.title + '” and its lessons and files will be removed. This can\'t be undone.', 'Delete module', function () { x.c.modules.splice(x.c.modules.indexOf(x.m), 1); save(); toast('Module deleted'); render(); }, true);
    },
    'add-lesson': function (el) {
      var x = findModule(el.dataset.course, el.dataset.module);
      openModal({ title: 'Add lesson', kicker: x.c.code + ' · ' + x.m.title, body: '<div class="form-grid">' + field('title', 'Lesson title', '', { required: true, full: true }) + field('type', 'Type', 'video', { type: 'select', options: [['video', 'Video'], ['reading', 'Reading'], ['lab', 'Lab / practical'], ['quiz', 'Quiz']] }) + field('duration', 'Duration', '15 min', { required: true }) + '</div>', submitLabel: 'Add lesson',
        onSubmit: function (d) { if (!String(d.title).trim()) return modalError('Enter a title.'); x.m.lessons.push({ id: uid('l'), title: String(d.title).trim(), type: d.type, duration: String(d.duration).trim() || '—' }); ui.openModules[x.m.id] = true; save(); closeModal(); toast('Lesson added'); render(); } });
    },
    'delete-lesson': function (el) {
      var x = findModule(el.dataset.course, el.dataset.module), l = x.m.lessons.find(function (y) { return y.id === el.dataset.lesson; });
      confirmModal('Delete lesson?', '“' + l.title + '” will be removed from this module.', 'Delete', function () { x.m.lessons.splice(x.m.lessons.indexOf(l), 1); save(); toast('Lesson deleted'); render(); }, true);
    },
    'upload-material': function (el) {
      var x = findModule(el.dataset.course, el.dataset.module);
      openModal({ title: 'Upload learning material', kicker: x.c.code + ' · ' + x.m.title, body: '<div class="field-group"><label for="mat-file">File</label><input id="mat-file" class="field" type="file" name="file" required></div><p class="small muted">Up to 20 MB. Students in ' + esc(x.c.code) + ' can download it once the module is published.</p>', submitLabel: 'Upload',
        onSubmit: function (_, form) {
          var f = form.querySelector('#mat-file').files[0];
          if (!f) return modalError('Choose a file to upload.');
          if (f.size > 20 * 1048576) return modalError('That file is larger than 20 MB.');
          x.m.materials.push({ id: uid('f'), name: f.name, size: fmtSize(f.size) }); ui.openModules[x.m.id] = true; save(); closeModal(); toast(f.name + ' uploaded'); render();
        } });
    },
    'delete-material': function (el) {
      var x = findModule(el.dataset.course, el.dataset.module), f = x.m.materials.find(function (y) { return y.id === el.dataset.file; });
      confirmModal('Delete file?', '“' + f.name + '” will no longer be available to students.', 'Delete', function () { x.m.materials.splice(x.m.materials.indexOf(f), 1); save(); toast('File deleted'); render(); }, true);
    },
    'create-assignment': function (el) { assignmentForm(null, el.dataset.course); },
    'edit-assignment': function (el) { assignmentForm(assignmentById(el.dataset.id)); },
    'pick-files': function () { var i = $('file-input'); if (i) i.click(); },
    'remove-file': function (el) { ui.pending.files.splice(Number(el.dataset.idx), 1); render(); },
    'submit-assignment': function (el) { submitAssignment(el.dataset.id); },
    'resubmit': function (el) { ui.resubmit[el.dataset.id] = true; ui.pending = { id: el.dataset.id, files: [] }; render(); },
    'cancel-resubmit': function (el) { ui.resubmit[el.dataset.id] = false; render(); },
    'grade': function (el) { gradeModal(el.dataset.assignment, el.dataset.student); },
    'post-announcement': function (el) { announcementForm(el.dataset.course); },
    'delete-announcement': function (el) {
      confirmModal('Delete announcement?', 'Students will no longer see it.', 'Delete', function () { state.announcements = state.announcements.filter(function (n) { return n.id !== el.dataset.id; }); save(); toast('Announcement deleted'); render(); }, true);
    },
    'add-user': function () { userForm(null); },
    'edit-user': function (el) { userForm(userById(el.dataset.id)); },
    'toggle-user': function (el) {
      var x = userById(el.dataset.id);
      if (x.active) confirmModal('Deactivate ' + x.name + '?', 'They will no longer be able to sign in. Their submissions and grades are kept.', 'Deactivate', function () { x.active = false; save(); toast(x.name + ' deactivated'); render(); }, true);
      else { x.active = true; save(); toast(x.name + ' can sign in again'); render(); }
    },
    'user-role': function (el) { ui.userRole = el.dataset.role; render(); },
    'create-course': courseForm,
    'enrol-course': function (el) { ui.enrolCourse = el.dataset.id; render(); },
    'add-students': function (el) { addStudentsForm(el.dataset.course); },
    'remove-student': function (el) {
      var s = userById(el.dataset.user), c = courseById(el.dataset.course);
      confirmModal('Remove ' + s.name + '?', 'They will lose access to ' + c.code + '. Their past submissions are kept.', 'Remove', function () { state.enrolments[c.id] = enrolled(c.id).filter(function (id) { return id !== s.id; }); save(); toast(s.name + ' removed from ' + c.code); render(); }, true);
    },
    'change-password': function () {
      openModal({ title: 'Change password', kicker: 'Account', body: field('current', 'Current password', '', { type: 'password', required: true }) + field('next', 'New password', '', { type: 'password', required: true, hint: 'At least 8 characters, with a number.' }) + field('confirm', 'Confirm new password', '', { type: 'password', required: true }), submitLabel: 'Update password',
        onSubmit: function (d) {
          var u = userById(me().id);
          if (d.current !== u.password) return modalError('Your current password is incorrect.');
          if (String(d.next).length < 8 || !/\d/.test(d.next)) return modalError('Use at least 8 characters, including a number.');
          if (d.next !== d.confirm) return modalError('The new passwords don\'t match.');
          u.password = d.next; save(); closeModal(); toast('Password updated');
        } });
    },
    'reset-demo': function () {
      confirmModal('Reset demo data?', 'All submissions, grades, users and content changes made in this browser will be replaced with the original demo data.', 'Reset', function () {
        var keep = session; state = window.PerceptionSeed(); save();
        ui.pending = { id: null, files: [] }; ui.drafts = {}; ui.resubmit = {};
        if (!userById(keep.userId)) { clearSession(); }
        toast('Demo data reset'); render();
      }, true);
    }
  };

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (el && ACTIONS[el.dataset.action]) {
      if (el.tagName === 'A' && el.dataset.action === 'close-modal') { closeModal(); return; }
      e.preventDefault(); ACTIONS[el.dataset.action](el, e); return;
    }
    if (e.target.closest('[data-modal-back]') && e.target.matches('[data-modal-back]')) { closeModal(); return; }
    var row = e.target.closest('tr[data-href]');
    if (row && !e.target.closest('a,button,input,select,label')) { go(row.dataset.href); return; }
    if (ui.popover && !e.target.closest('.popover')) { ui.popover = null; render(); }
    if (!e.target.closest('.top-search')) { var sp = $('search-pop'); if (sp) sp.innerHTML = ''; }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id === 'login-form') { e.preventDefault(); doLogin(e.target); return; }
    if (e.target.id === 'modal-form') {
      e.preventDefault();
      var fd = new FormData(e.target), data = {};
      fd.forEach(function (v, k) { data[k] = v; });
      if (modalSubmit) modalSubmit(data, e.target);
    }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'global-search') { runSearch(t.value); return; }
    if (t.dataset.q) {
      ui.q[t.dataset.q] = t.value; var id = t.id, pos = t.selectionStart; render();
      var n = $(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (err) { /* search inputs */ } }
      return;
    }
    if (t.dataset.draft) { ui.drafts[t.dataset.draft] = t.value; var wc = $('word-count'); if (wc) wc.textContent = wordCount(t.value) + ' words'; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, k = t.dataset.change;
    if (t.dataset.own) { ui.confirmOwn[t.dataset.own] = t.checked; return; }
    if (!k) return;
    if (k === 'files') { addFiles(t.files); return; }
    if (k === 'course-filter') { ui.courseFilter[t.dataset.key] = t.value; render(); return; }
    if (k === 'gradebook') { ui.gradebookCourse = t.value; render(); return; }
    if (k === 'theme') { setTheme(t.value); render(); toast('Appearance updated'); return; }
    if (k === 'pref') { var id = me().id; state.prefs = state.prefs || {}; state.prefs[id] = state.prefs[id] || { email: true, digest: false }; state.prefs[id][t.dataset.key] = t.checked; save(); toast('Preference saved'); return; }
    if (k === 'set-lecturer') { var c = courseById(t.dataset.course); c.lecturerId = t.value || null; save(); toast(c.code + ' lecturer updated'); render(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if ($('modal-root').innerHTML) { closeModal(); return; }
      if (ui.popover || ui.menuOpen) { ui.popover = null; ui.menuOpen = false; render(); return; }
      var sp = $('search-pop'); if (sp) sp.innerHTML = '';
    }
    if (e.key === 'Enter' && e.target.id === 'global-search') { var first = document.querySelector('#search-pop a'); if (first) { go(first.getAttribute('href')); } }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('dropzone')) { e.preventDefault(); ACTIONS['pick-files'](); }
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && $('global-search')) { e.preventDefault(); $('global-search').focus(); }
    // Keep keyboard focus inside an open dialog.
    if (e.key === 'Tab' && $('modal-form')) {
      var f = $('modal-form').querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      var firstEl = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); firstEl.focus(); }
    }
  });
  ['dragover', 'dragenter'].forEach(function (ev) { document.addEventListener(ev, function (e) { var z = e.target.closest && e.target.closest('.dropzone'); if (z) { e.preventDefault(); z.classList.add('drag'); } }); });
  document.addEventListener('dragleave', function (e) { var z = e.target.closest && e.target.closest('.dropzone'); if (z) z.classList.remove('drag'); });
  document.addEventListener('drop', function (e) { var z = e.target.closest && e.target.closest('.dropzone'); if (z) { e.preventDefault(); z.classList.remove('drag'); addFiles(e.dataTransfer.files); } });
  // Navigating closes any open dialog (e.g. "Back to assignments" in the receipt).
  window.addEventListener('hashchange', function () { if ($('modal-root').innerHTML) closeModal(); render(); });
  // Keep other tabs in sync (e.g. a lecturer grades in one tab while the student view is open in another).
  window.addEventListener('storage', function (e) { if (e.key === STATE_KEY && e.newValue) { try { state = JSON.parse(e.newValue); render(); } catch (err) { /* ignore */ } } });

  render();
})();
