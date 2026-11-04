import 'dotenv/config'; import express from 'express'; import cors from 'cors'; import session from 'express-session';
import passport from 'passport'; import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import bcrypt from 'bcryptjs'; import jwt from 'jsonwebtoken'; import { db, save, id } from './db.js';

const { PORT=4000, CLIENT_URL='http://localhost:5173', JWT_SECRET='dev', SESSION_SECRET='dev', GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL='http://localhost:4000/api/auth/google/callback' } = process.env;
const app = express();
app.use(cors({ origin: CLIENT_URL, credentials: true })); app.use(express.json());
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false }));
app.use(passport.initialize());

const pub = u => u && ({ id:u.id, name:u.name, email:u.email, role:u.role, avatar:u.avatar });
const sign = u => jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '7d' });
const auth = (req,res,next)=>{ try{ const t=(req.headers.authorization||'').replace('Bearer ',''); const {id:uid}=jwt.verify(t,JWT_SECRET); req.user=db.users.find(u=>u.id===uid); if(!req.user) throw 0; next(); }catch{ res.status(401).json({error:'Unauthorized'}); } };
const role = (...r)=>(req,res,next)=> r.includes(req.user.role)?next():res.status(403).json({error:'Forbidden'});
const canTeach = (u,c)=> u.role==='admin' || c.teacherId===u.id;
const isEnrolled = (uid,cid)=> db.enrollments.some(e=>e.userId===uid&&e.courseId===cid);
const getCourse = (req,res)=>{ const c=db.courses.find(c=>c.id===req.params.id); if(!c){res.status(404).json({error:'Not found'});return null;} if(!(canTeach(req.user,c)||isEnrolled(req.user.id,c.id))){res.status(403).json({error:'Forbidden'});return null;} return c; };

// ---------- Google SSO ----------
const googleEnabled = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
if (googleEnabled) passport.use(new GoogleStrategy({ clientID: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, callbackURL: GOOGLE_CALLBACK_URL },
  (_a,_r,profile,done)=>{ const email=profile.emails?.[0]?.value; let u=db.users.find(x=>x.googleId===profile.id||x.email===email);
    if(!u){ u={id:id(),name:profile.displayName,email,role:'student',googleId:profile.id,avatar:profile.photos?.[0]?.value,createdAt:new Date().toISOString()}; db.users.push(u); }
    else { u.googleId=profile.id; u.avatar ||= profile.photos?.[0]?.value; } save(); done(null,u); }));
app.get('/api/auth/config', (_q,res)=>res.json({ googleEnabled }));
app.get('/api/auth/google', (req,res,next)=> googleEnabled ? passport.authenticate('google',{scope:['profile','email'],session:false})(req,res,next) : res.redirect(`${CLIENT_URL}/login?error=google_not_configured`));
app.get('/api/auth/google/callback', passport.authenticate('google',{session:false,failureRedirect:`${CLIENT_URL}/login?error=google`}), (req,res)=>res.redirect(`${CLIENT_URL}/auth/callback?token=${sign(req.user)}`));

// ---------- Local auth ----------
app.post('/api/auth/login', (req,res)=>{ const {email,password}=req.body; const u=db.users.find(u=>u.email===email?.toLowerCase());
  if(!u||!u.password||!bcrypt.compareSync(password||'',u.password)) return res.status(401).json({error:'Invalid email or password'}); res.json({token:sign(u),user:pub(u)}); });
app.post('/api/auth/register', (req,res)=>{ const {name,email,password,role:r='student'}=req.body; if(!name||!email||!password) return res.status(400).json({error:'Missing fields'});
  if(db.users.some(u=>u.email===email.toLowerCase())) return res.status(409).json({error:'Email in use'});
  const u={id:id(),name,email:email.toLowerCase(),role:['student','teacher'].includes(r)?r:'student',password:bcrypt.hashSync(password,8),createdAt:new Date().toISOString()}; db.users.push(u); save(); res.json({token:sign(u),user:pub(u)}); });
app.get('/api/auth/me', auth, (req,res)=>res.json(pub(req.user)));

// ---------- helpers ----------
const progressOf = (uid,cid)=>{ const total=db.lessons.filter(l=>l.courseId===cid).length; const done=db.completions.filter(c=>c.userId===uid&&c.courseId===cid).length; return { done, total, percent: total?Math.round(done/total*100):0 }; };
const attendanceOf = (uid,cid)=>{ const sids=new Set(db.sessions.filter(s=>!cid||s.courseId===cid).map(s=>s.id)); const recs=db.attendance.filter(a=>a.userId===uid&&sids.has(a.sessionId));
  const c={present:0,late:0,absent:0,excused:0}; recs.forEach(r=>c[r.status]++); const counted=recs.length-c.excused; return {...c,total:recs.length,percent:counted?Math.round((c.present+c.late)/counted*100):100}; };
const gradeOf = (uid,cid)=>{ const as=db.assignments.filter(a=>a.courseId===cid); let earned=0,possible=0; as.forEach(a=>{ const s=db.submissions.find(s=>s.assignmentId===a.id&&s.userId===uid); if(s&&s.grade!=null){earned+=s.grade;possible+=a.points;} }); return possible?Math.round(earned/possible*100):null; };
const courseCard = (c,u)=>({ ...c, teacher: pub(db.users.find(x=>x.id===c.teacherId)), studentCount: db.enrollments.filter(e=>e.courseId===c.id).length,
  ...(u.role==='student'?{progress:progressOf(u.id,c.id),attendance:attendanceOf(u.id,c.id).percent,grade:gradeOf(u.id,c.id)}:{}) });
const myCourses = u => u.role==='admin'?db.courses: u.role==='teacher'?db.courses.filter(c=>c.teacherId===u.id): db.courses.filter(c=>isEnrolled(u.id,c.id));

// ---------- Dashboard ----------
app.get('/api/dashboard', auth, (req,res)=>{ const u=req.user; const courses=myCourses(u).map(c=>courseCard(c,u)); const cids=new Set(courses.map(c=>c.id));
  const upcoming=db.assignments.filter(a=>cids.has(a.courseId)&&a.dueDate>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,6).map(a=>({...a,course:db.courses.find(c=>c.id===a.courseId)?.code, submitted: !!db.submissions.find(s=>s.assignmentId===a.id&&s.userId===u.id)}));
  const announcements=db.announcements.filter(a=>cids.has(a.courseId)).map(a=>({...a,course:db.courses.find(c=>c.id===a.courseId)?.code})).reverse().slice(0,5);
  let stats;
  if(u.role==='student'){ const att=attendanceOf(u.id); const grades=courses.map(c=>c.grade).filter(g=>g!=null); stats={courses:courses.length,attendance:att.percent,avgGrade:grades.length?Math.round(grades.reduce((a,b)=>a+b)/grades.length):0,avgProgress:courses.length?Math.round(courses.reduce((a,c)=>a+c.progress.percent,0)/courses.length):0}; }
  else { const sids=new Set(db.enrollments.filter(e=>cids.has(e.courseId)).map(e=>e.userId)); const ses=new Set(db.sessions.filter(s=>cids.has(s.courseId)).map(s=>s.id)); const recs=db.attendance.filter(a=>ses.has(a.sessionId));
    const ungraded=db.submissions.filter(s=>{const a=db.assignments.find(a=>a.id===s.assignmentId);return a&&cids.has(a.courseId)&&s.grade==null;}).length;
    stats={courses:courses.length,students:sids.size,attendance:recs.length?Math.round(recs.filter(r=>r.status!=='absent').length/recs.length*100):0,ungraded}; }
  res.json({courses,upcoming,announcements,stats}); });

// ---------- Courses ----------
app.get('/api/courses', auth, (req,res)=>res.json(myCourses(req.user).map(c=>courseCard(c,req.user))));
app.get('/api/courses/catalog', auth, (req,res)=>res.json(db.courses.filter(c=>c.published).map(c=>({...courseCard(c,{role:'x'}),enrolled:isEnrolled(req.user.id,c.id)}))));
app.post('/api/courses', auth, role('teacher','admin'), (req,res)=>{ const {code,name,description,color='#2563eb',term='Semester 2, 2026'}=req.body; if(!code||!name) return res.status(400).json({error:'Code and name required'});
  const c={id:id(),code,name,description,color,term,teacherId:req.user.id,published:true,createdAt:new Date().toISOString()}; db.courses.push(c); save(); res.json(c); });
app.get('/api/courses/:id', auth, (req,res)=>{ const c=getCourse(req,res); if(!c) return; const u=req.user; const done=new Set(db.completions.filter(x=>x.userId===u.id).map(x=>x.lessonId));
  const modules=db.modules.filter(m=>m.courseId===c.id).sort((a,b)=>a.position-b.position).map(m=>({...m,lessons:db.lessons.filter(l=>l.moduleId===m.id).sort((a,b)=>a.position-b.position).map(l=>({...l,completed:done.has(l.id)}))}));
  const assignments=db.assignments.filter(a=>a.courseId===c.id).map(a=>({...a,submission:db.submissions.find(s=>s.assignmentId===a.id&&s.userId===u.id)||null,submissionCount:db.submissions.filter(s=>s.assignmentId===a.id).length}));
  res.json({...courseCard(c,u),modules,assignments,announcements:db.announcements.filter(a=>a.courseId===c.id).reverse(),canEdit:canTeach(u,c)}); });
app.put('/api/courses/:id', auth, (req,res)=>{ const c=getCourse(req,res); if(!c) return; if(!canTeach(req.user,c)) return res.status(403).json({error:'Forbidden'}); ['code','name','description','color','term','published'].forEach(k=>req.body[k]!==undefined&&(c[k]=req.body[k])); save(); res.json(c); });
app.delete('/api/courses/:id', auth, (req,res)=>{ const c=getCourse(req,res); if(!c) return; if(!canTeach(req.user,c)) return res.status(403).json({error:'Forbidden'}); db.courses=db.courses.filter(x=>x.id!==c.id); Object.assign(db,{courses:db.courses}); save(); res.json({ok:true}); });
app.post('/api/courses/:id/enroll', auth, (req,res)=>{ const c=db.courses.find(c=>c.id===req.params.id); if(!c) return res.status(404).end(); const uid = req.user.role==='student'?req.user.id:req.body.userId;
  if(req.user.role!=='student'&&!canTeach(req.user,c)) return res.status(403).end(); if(!isEnrolled(uid,c.id)) db.enrollments.push({id:id(),courseId:c.id,userId:uid,enrolledAt:new Date().toISOString()}); save(); res.json({ok:true}); });
app.delete('/api/courses/:id/enroll/:uid', auth, (req,res)=>{ const c=getCourse(req,res); if(!c) return; if(!canTeach(req.user,c)) return res.status(403).end(); db.enrollments=db.enrollments.filter(e=>!(e.courseId===c.id&&e.userId===req.params.uid)); save(); res.json({ok:true}); });
app.get('/api/courses/:id/people', auth, (req,res)=>{ const c=getCourse(req,res); if(!c) return; const teach=canTeach(req.user,c);
  res.json({teacher:pub(db.users.find(u=>u.id===c.teacherId)),students:db.enrollments.filter(e=>e.courseId===c.id).map(e=>{const s=db.users.find(u=>u.id===e.userId); return {...pub(s),...(teach?{progress:progressOf(s.id,c.id).percent,attendance:attendanceOf(s.id,c.id).percent,grade:gradeOf(s.id,c.id)}:{})};}),
    available: teach? db.users.filter(u=>u.role==='student'&&!isEnrolled(u.id,c.id)).map(pub):[] }); });
app.post('/api/courses/:id/announcements', auth, (req,res)=>{ const c=getCourse(req,res); if(!c) return; if(!canTeach(req.user,c)) return res.status(403).end(); const a={id:id(),courseId:c.id,title:req.body.title,body:req.body.body,createdAt:new Date().toISOString()}; db.announcements.push(a); save(); res.json(a); });

// ---------- Modules / lessons ----------
app.post('/api/courses/:id/modules', auth, (req,res)=>{ const c=getCourse(req,res); if(!c) return; if(!canTeach(req.user,c)) return res.status(403).end(); const m={id:id(),courseId:c.id,title:req.body.title,position:db.modules.filter(m=>m.courseId===c.id).length}; db.modules.push(m); save(); res.json(m); });
app.delete('/api/modules/:mid', auth, role('teacher','admin'), (req,res)=>{ db.modules=db.modules.filter(m=>m.id!==req.params.mid); db.lessons=db.lessons.filter(l=>l.moduleId!==req.params.mid); save(); res.json({ok:true}); });
app.post('/api/modules/:mid/lessons', auth, role('teacher','admin'), (req,res)=>{ const m=db.modules.find(m=>m.id===req.params.mid); if(!m) return res.status(404).end();
  const l={id:id(),courseId:m.courseId,moduleId:m.id,title:req.body.title,content:req.body.content||'',duration:+req.body.duration||15,position:db.lessons.filter(l=>l.moduleId===m.id).length}; db.lessons.push(l); save(); res.json(l); });
app.get('/api/lessons/:lid', auth, (req,res)=>{ const l=db.lessons.find(l=>l.id===req.params.lid); if(!l) return res.status(404).end(); const all=db.lessons.filter(x=>x.courseId===l.courseId).sort((a,b)=>{const ma=db.modules.find(m=>m.id===a.moduleId)?.position??0, mb=db.modules.find(m=>m.id===b.moduleId)?.position??0; return ma-mb||a.position-b.position;});
  const i=all.findIndex(x=>x.id===l.id); res.json({...l,completed:db.completions.some(c=>c.userId===req.user.id&&c.lessonId===l.id),prev:all[i-1]?.id||null,next:all[i+1]?.id||null,module:db.modules.find(m=>m.id===l.moduleId)?.title}); });
app.put('/api/lessons/:lid', auth, role('teacher','admin'), (req,res)=>{ const l=db.lessons.find(l=>l.id===req.params.lid); if(!l) return res.status(404).end(); ['title','content','duration'].forEach(k=>req.body[k]!==undefined&&(l[k]=req.body[k])); save(); res.json(l); });
app.delete('/api/lessons/:lid', auth, role('teacher','admin'), (req,res)=>{ db.lessons=db.lessons.filter(l=>l.id!==req.params.lid); save(); res.json({ok:true}); });
app.post('/api/lessons/:lid/complete', auth, (req,res)=>{ const l=db.lessons.find(l=>l.id===req.params.lid); if(!l) return res.status(404).end(); const ex=db.completions.find(c=>c.userId===req.user.id&&c.lessonId===l.id);
  if(ex) db.completions=db.completions.filter(c=>c!==ex); else db.completions.push({id:id(),userId:req.user.id,lessonId:l.id,courseId:l.courseId,completedAt:new Date().toISOString()}); save(); res.json({completed:!ex,progress:progressOf(req.user.id,l.courseId)}); });

// ---------- Assignments & grades ----------
app.post('/api/courses/:id/assignments', auth, (req,res)=>{ const c=getCourse(req,res); if(!c) return; if(!canTeach(req.user,c)) return res.status(403).end(); const a={id:id(),courseId:c.id,title:req.body.title,description:req.body.description||'',points:+req.body.points||100,dueDate:req.body.dueDate}; db.assignments.push(a); save(); res.json(a); });
app.delete('/api/assignments/:aid', auth, role('teacher','admin'), (req,res)=>{ db.assignments=db.assignments.filter(a=>a.id!==req.params.aid); save(); res.json({ok:true}); });
app.post('/api/assignments/:aid/submit', auth, role('student'), (req,res)=>{ let s=db.submissions.find(s=>s.assignmentId===req.params.aid&&s.userId===req.user.id);
  if(s){ s.content=req.body.content; s.submittedAt=new Date().toISOString(); } else { s={id:id(),assignmentId:req.params.aid,userId:req.user.id,content:req.body.content,submittedAt:new Date().toISOString(),grade:null}; db.submissions.push(s);} save(); res.json(s); });
app.get('/api/courses/:id/gradebook', auth, (req,res)=>{ const c=getCourse(req,res); if(!c) return; const as=db.assignments.filter(a=>a.courseId===c.id);
  const students = canTeach(req.user,c) ? db.enrollments.filter(e=>e.courseId===c.id).map(e=>db.users.find(u=>u.id===e.userId)) : [req.user];
  res.json({assignments:as,rows:students.map(s=>({student:pub(s),total:gradeOf(s.id,c.id),progress:progressOf(s.id,c.id).percent,grades:Object.fromEntries(as.map(a=>{const sub=db.submissions.find(x=>x.assignmentId===a.id&&x.userId===s.id); return [a.id,sub?{grade:sub.grade,submitted:true,id:sub.id,content:sub.content}:null];}))}))}); });
app.put('/api/grades', auth, role('teacher','admin'), (req,res)=>{ const {assignmentId,userId,grade,feedback}=req.body; let s=db.submissions.find(s=>s.assignmentId===assignmentId&&s.userId===userId);
  if(!s){ s={id:id(),assignmentId,userId,content:'',submittedAt:null}; db.submissions.push(s);} s.grade=grade===''||grade==null?null:+grade; if(feedback!==undefined) s.feedback=feedback; save(); res.json(s); });

// ---------- Attendance ----------
app.get('/api/courses/:id/attendance', auth, (req,res)=>{ const c=getCourse(req,res); if(!c) return; const sessions=db.sessions.filter(s=>s.courseId===c.id).sort((a,b)=>a.date.localeCompare(b.date));
  if(!canTeach(req.user,c)) return res.json({sessions:sessions.map(s=>({...s,status:db.attendance.find(a=>a.sessionId===s.id&&a.userId===req.user.id)?.status||null})),summary:attendanceOf(req.user.id,c.id)});
  const students=db.enrollments.filter(e=>e.courseId===c.id).map(e=>db.users.find(u=>u.id===e.userId));
  res.json({sessions,students:students.map(s=>({...pub(s),summary:attendanceOf(s.id,c.id),records:Object.fromEntries(sessions.map(se=>[se.id,db.attendance.find(a=>a.sessionId===se.id&&a.userId===s.id)?.status||null]))}))}); });
app.post('/api/courses/:id/sessions', auth, (req,res)=>{ const c=getCourse(req,res); if(!c) return; if(!canTeach(req.user,c)) return res.status(403).end(); const s={id:id(),courseId:c.id,date:req.body.date||new Date().toISOString().slice(0,10),topic:req.body.topic||'Class session'}; db.sessions.push(s); save(); res.json(s); });
app.put('/api/sessions/:sid/attendance', auth, role('teacher','admin'), (req,res)=>{ const {records}=req.body; // {userId:status}
  Object.entries(records||{}).forEach(([uid,status])=>{ let a=db.attendance.find(a=>a.sessionId===req.params.sid&&a.userId===uid); if(!status){ db.attendance=db.attendance.filter(x=>x!==a); return; } if(a) a.status=status; else db.attendance.push({id:id(),sessionId:req.params.sid,userId:uid,status}); }); save(); res.json({ok:true}); });
app.get('/api/me/attendance', auth, (req,res)=>res.json(myCourses(req.user).map(c=>({course:{id:c.id,code:c.code,name:c.name,color:c.color},...attendanceOf(req.user.id,c.id)}))));

// ---------- Admin ----------
app.get('/api/users', auth, role('admin','teacher'), (_q,res)=>res.json(db.users.map(pub)));
app.put('/api/users/:uid/role', auth, role('admin'), (req,res)=>{ const u=db.users.find(u=>u.id===req.params.uid); if(!u) return res.status(404).end(); u.role=req.body.role; save(); res.json(pub(u)); });

app.get('/api/health', (_q,res)=>res.json({ok:true}));
app.listen(PORT, ()=>console.log(`API on http://localhost:${PORT} (Google SSO ${googleEnabled?'enabled':'disabled'})`));
