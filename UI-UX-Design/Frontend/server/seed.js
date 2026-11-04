import bcrypt from 'bcryptjs'; import fs from 'fs'; import { DB_FILE, id } from './db.js';
const pw = bcrypt.hashSync('password123', 8);
const d = { users: [], courses: [], modules: [], lessons: [], assignments: [], submissions: [], enrollments: [], sessions: [], attendance: [], completions: [], announcements: [] };
const U = (name, email, role) => { const u = { id: id(), name, email, role, password: pw, avatar: null, createdAt: new Date().toISOString() }; d.users.push(u); return u; };
U('Admin User', 'admin@demo.edu', 'admin');
const t1 = U('Dr. Sarah Chen', 'teacher@demo.edu', 'teacher');
const t2 = U('Prof. James Miller', 'james@demo.edu', 'teacher');
const studs = [['Badal Mainali','student@demo.edu'],['Aisha Khan','aisha@demo.edu'],['Liam Nguyen','liam@demo.edu'],['Olivia Brown','olivia@demo.edu'],['Noah Patel','noah@demo.edu'],['Emma Wilson','emma@demo.edu'],['Lucas Garcia','lucas@demo.edu'],['Mia Thompson','mia@demo.edu']].map(([n,e])=>U(n,e,'student'));
const colors = ['#2563eb','#059669','#d97706','#7c3aed'];
const specs = [
 { code:'CS101', name:'Introduction to Web Development', t:t1, desc:'HTML, CSS, JavaScript fundamentals and modern tooling.', mods:[['Getting Started',['Course overview','How the web works','Setting up VS Code']],['HTML & CSS',['Semantic HTML','Flexbox & Grid','Responsive design']],['JavaScript',['Variables & types','Functions & scope','DOM manipulation']]]},
 { code:'CS205', name:'Full-Stack MERN Development', t:t1, desc:'Build production apps with MongoDB, Express, React and Node.', mods:[['Node & Express',['Node runtime','REST APIs with Express','Middleware & auth']],['React',['Components & props','Hooks deep dive','Routing & state']],['Deployment',['Docker basics','CI/CD pipelines']]]},
 { code:'DS110', name:'Data Science Foundations', t:t2, desc:'Statistics, Python and data visualisation.', mods:[['Python',['Python refresher','NumPy & Pandas']],['Statistics',['Descriptive stats','Probability','Hypothesis testing']]]},
 { code:'BUS150', name:'Project Management Essentials', t:t2, desc:'Agile, Scrum and stakeholder management.', mods:[['Foundations',['What is a project?','Waterfall vs Agile']],['Scrum',['Roles & ceremonies','Backlogs & sprints']]]},
];
const rnd = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
specs.forEach((s,ci)=>{
  const c = { id:id(), code:s.code, name:s.name, description:s.desc, teacherId:s.t.id, color:colors[ci], term:'Semester 2, 2026', published:true, createdAt:new Date().toISOString() }; d.courses.push(c);
  const lessonIds=[];
  s.mods.forEach((m,mi)=>{ const mod={id:id(),courseId:c.id,title:m[0],position:mi}; d.modules.push(mod);
    m[1].forEach((l,li)=>{ const les={id:id(),courseId:c.id,moduleId:mod.id,title:l,position:li,duration:rnd(10,45),content:`## ${l}\n\nIn this lesson we cover **${l.toLowerCase()}**. Read the material, watch the embedded video and complete the check-in quiz.\n\n- Key concept one\n- Key concept two\n- Practice exercise`}; d.lessons.push(les); lessonIds.push(les.id); }); });
  const asg = ['Quiz 1','Assignment 1','Midterm Project','Final Exam'].map((t,i)=>{ const a={id:id(),courseId:c.id,title:`${t}`,description:`Complete ${t.toLowerCase()} for ${s.code}.`,points:[20,50,100,100][i],dueDate:new Date(Date.now()+(i-1.5)*14*864e5).toISOString().slice(0,10)}; d.assignments.push(a); return a; });
  const enrolled = studs.filter((_,i)=> ci<2 ? true : i%2===ci%2 || i===0);
  enrolled.forEach(st=>{ d.enrollments.push({id:id(),courseId:c.id,userId:st.id,enrolledAt:new Date().toISOString()});
    const done=rnd(2,lessonIds.length); lessonIds.slice(0,done).forEach(lid=>d.completions.push({id:id(),userId:st.id,lessonId:lid,courseId:c.id,completedAt:new Date().toISOString()}));
    asg.slice(0,2).forEach(a=>d.submissions.push({id:id(),assignmentId:a.id,userId:st.id,content:'My submission',submittedAt:new Date().toISOString(),grade:Math.round(a.points*rnd(60,100)/100),feedback:'Good work!'}));
  });
  for(let k=8;k>=1;k--){ const date=new Date(Date.now()-k*3.5*864e5).toISOString().slice(0,10); const ses={id:id(),courseId:c.id,date,topic:`Week ${9-k} lecture`}; d.sessions.push(ses);
    enrolled.forEach(st=>{ const r=Math.random(); d.attendance.push({id:id(),sessionId:ses.id,userId:st.id,status:r<0.78?'present':r<0.88?'late':r<0.95?'absent':'excused'}); }); }
  d.announcements.push({id:id(),courseId:c.id,title:`Welcome to ${s.code}!`,body:'Please review the syllabus in Module 1 and introduce yourself.',createdAt:new Date().toISOString()});
});
fs.writeFileSync(DB_FILE, JSON.stringify(d,null,2)); console.log('Seeded', DB_FILE);
