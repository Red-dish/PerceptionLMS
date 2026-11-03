/*
 * Perception LMS — demo data.
 * Dates are generated relative to "today" so deadlines always look current in a presentation.
 * Shapes loosely follow the backend models (users, courses, modules, materials, assignments,
 * submissions, announcements) so this can later be swapped for real API calls.
 */
(function () {
  function day(offset, hour, minute) {
    var d = new Date();
    d.setDate(d.getDate() + offset);
    d.setHours(hour == null ? 23 : hour, minute == null ? 59 : minute, 0, 0);
    return d.toISOString();
  }

  function seed() {
    var users = [
      { id: 'u-stu-1', name: 'Alex Morgan', email: 'student@perception.demo', password: 'Student@123', role: 'student', active: true, studentId: 'ASA-2026-0142', program: 'Diploma of Information Technology', color: '#3c886d' },
      { id: 'u-lec-1', name: 'Dr. Maya Chen', email: 'lecturer@perception.demo', password: 'Lecturer@123', role: 'lecturer', active: true, title: 'Senior Lecturer, School of IT', color: '#b1603b' },
      { id: 'u-adm-1', name: 'Morgan Ellis', email: 'admin@perception.demo', password: 'Admin@123', role: 'admin', active: true, title: 'Academic Administrator', color: '#43658b' },
      { id: 'u-lec-2', name: 'Prof. Daniel Okafor', email: 'd.okafor@perception.demo', role: 'lecturer', active: true, title: 'Lecturer, Business School', color: '#925b74' },
      { id: 'u-lec-3', name: 'Sam Rivera', email: 's.rivera@perception.demo', role: 'lecturer', active: true, title: 'Lecturer, Cybersecurity', color: '#6b7a2e' },
      { id: 'u-stu-2', name: 'Sam Patel', email: 'sam.patel@perception.demo', role: 'student', active: true, studentId: 'ASA-2026-0143', color: '#2f7d8c' },
      { id: 'u-stu-3', name: 'Taylor Brooks', email: 'taylor.b@perception.demo', role: 'student', active: true, studentId: 'ASA-2026-0144', color: '#8a5a2b' },
      { id: 'u-stu-4', name: 'Riya Gurung', email: 'riya.g@perception.demo', role: 'student', active: true, studentId: 'ASA-2026-0145', color: '#7b4f9d' },
      { id: 'u-stu-5', name: 'Chris Nguyen', email: 'chris.n@perception.demo', role: 'student', active: false, studentId: 'ASA-2026-0146', color: '#5b6b70' }
    ];

    var courses = [
      {
        id: 'c-mai600', code: 'MAI600', name: 'Applied Artificial Intelligence', lecturerId: 'u-lec-1', term: 'Term 4 · 2026', credits: 10, color: '#17483f',
        description: 'Plan, build and evaluate practical AI solutions for business problems, with a focus on responsible and ethical use.',
        modules: [
          { id: 'm1', title: 'Foundations of AI', published: true,
            lessons: [{ id: 'l1', title: 'What is AI? History and key ideas', type: 'video', duration: '18 min' }, { id: 'l2', title: 'Machine learning vs. rules-based systems', type: 'reading', duration: '12 min' }, { id: 'l3', title: 'Check your understanding', type: 'quiz', duration: '10 min' }],
            materials: [{ id: 'f1', name: 'Week 1 Lecture Slides.pptx', size: '4.2 MB' }, { id: 'f2', name: 'AI Glossary.pdf', size: '640 KB' }] },
          { id: 'm2', title: 'Data and Model Building', published: true,
            lessons: [{ id: 'l4', title: 'Preparing data for models', type: 'video', duration: '22 min' }, { id: 'l5', title: 'Training your first classifier', type: 'lab', duration: '45 min' }, { id: 'l6', title: 'Evaluating model performance', type: 'reading', duration: '15 min' }],
            materials: [{ id: 'f3', name: 'Lab 2 Notebook.ipynb', size: '220 KB' }, { id: 'f4', name: 'Customer Churn Dataset.csv', size: '1.8 MB' }] },
          { id: 'm3', title: 'Responsible and Ethical AI', published: true,
            lessons: [{ id: 'l7', title: 'Bias, fairness and transparency', type: 'video', duration: '20 min' }, { id: 'l8', title: 'Privacy law in Australia', type: 'reading', duration: '14 min' }],
            materials: [{ id: 'f5', name: 'Ethics Case Studies.pdf', size: '1.1 MB' }] },
          { id: 'm4', title: 'Generative AI in the Workplace', published: false,
            lessons: [{ id: 'l9', title: 'Prompting and evaluation', type: 'video', duration: '25 min' }],
            materials: [] }
        ]
      },
      {
        id: 'c-bus210', code: 'BUS210', name: 'Business Analytics', lecturerId: 'u-lec-2', term: 'Term 4 · 2026', credits: 10, color: '#7a4a2a',
        description: 'Turn business data into decisions with descriptive statistics, dashboards and clear data storytelling.',
        modules: [
          { id: 'm5', title: 'Thinking with Data', published: true,
            lessons: [{ id: 'l10', title: 'The analytics lifecycle', type: 'video', duration: '16 min' }, { id: 'l11', title: 'Asking the right business questions', type: 'reading', duration: '10 min' }],
            materials: [{ id: 'f6', name: 'Week 1 Slides.pdf', size: '2.3 MB' }] },
          { id: 'm6', title: 'Dashboards and Visualisation', published: true,
            lessons: [{ id: 'l12', title: 'Choosing the right chart', type: 'video', duration: '19 min' }, { id: 'l13', title: 'Building a sales dashboard', type: 'lab', duration: '50 min' }],
            materials: [{ id: 'f7', name: 'Sales Data Q3.xlsx', size: '950 KB' }, { id: 'f8', name: 'Dashboard Design Checklist.pdf', size: '310 KB' }] }
        ]
      },
      {
        id: 'c-ict220', code: 'ICT220', name: 'Web Development Fundamentals', lecturerId: 'u-lec-1', term: 'Term 4 · 2026', credits: 10, color: '#2f5f8a',
        description: 'Build accessible, responsive websites with semantic HTML, modern CSS and JavaScript.',
        modules: [
          { id: 'm7', title: 'HTML and Semantic Structure', published: true,
            lessons: [{ id: 'l14', title: 'Document structure', type: 'video', duration: '14 min' }, { id: 'l15', title: 'Forms and accessibility', type: 'reading', duration: '18 min' }],
            materials: [{ id: 'f9', name: 'HTML Cheat Sheet.pdf', size: '420 KB' }] },
          { id: 'm8', title: 'Responsive CSS', published: true,
            lessons: [{ id: 'l16', title: 'Flexbox and Grid', type: 'video', duration: '24 min' }, { id: 'l17', title: 'Build a responsive landing page', type: 'lab', duration: '60 min' }],
            materials: [{ id: 'f10', name: 'Starter Files.zip', size: '3.4 MB' }] },
          { id: 'm9', title: 'JavaScript Essentials', published: true,
            lessons: [{ id: 'l18', title: 'Variables, functions and events', type: 'video', duration: '26 min' }, { id: 'l19', title: 'Working with the DOM', type: 'lab', duration: '40 min' }],
            materials: [{ id: 'f11', name: 'JS Exercises.pdf', size: '780 KB' }] }
        ]
      },
      {
        id: 'c-cyb230', code: 'CYB230', name: 'Cybersecurity Essentials', lecturerId: 'u-lec-3', term: 'Term 4 · 2026', credits: 10, color: '#5a3d6e',
        description: 'Understand common threats, security controls and how organisations protect people and data.',
        modules: [
          { id: 'm10', title: 'The Threat Landscape', published: true,
            lessons: [{ id: 'l20', title: 'Phishing and social engineering', type: 'video', duration: '17 min' }],
            materials: [{ id: 'f12', name: 'Threat Report Summary.pdf', size: '1.4 MB' }] }
        ]
      }
    ];

    var enrolments = {
      'c-mai600': ['u-stu-1', 'u-stu-2', 'u-stu-3', 'u-stu-4'],
      'c-bus210': ['u-stu-1', 'u-stu-2', 'u-stu-5'],
      'c-ict220': ['u-stu-1', 'u-stu-3', 'u-stu-4'],
      'c-cyb230': ['u-stu-2', 'u-stu-4']
    };

    var assignments = [
      { id: 'a1', courseId: 'c-mai600', title: 'AI Use-Case Proposal', due: day(2), points: 100, submitType: 'both', published: true,
        instructions: 'Identify a real business problem at an organisation you know and propose an AI solution for it.\n\nYour proposal (1,000–1,200 words) should cover:\n- The business problem and who it affects\n- The data you would need and where it comes from\n- The type of AI approach and why it fits\n- Risks, including privacy and bias, and how you would reduce them',
        rubric: [['Problem definition', 20], ['Data and approach', 35], ['Risk and ethics', 30], ['Writing and referencing', 15]] },
      { id: 'a2', courseId: 'c-bus210', title: 'Sales Dashboard Report', due: day(5), points: 100, submitType: 'file', published: true,
        instructions: 'Using the Q3 sales data in Module 2, build a one-page dashboard and a short report (500 words) explaining three insights for the sales manager.\n\nSubmit your dashboard as a PDF or image, and your report as a PDF or Word document.',
        rubric: [['Dashboard design', 40], ['Insights', 40], ['Communication', 20]] },
      { id: 'a3', courseId: 'c-ict220', title: 'Responsive Landing Page', due: day(-3), points: 100, submitType: 'file', published: true,
        instructions: 'Build a responsive landing page for a fictional small business using semantic HTML and CSS Grid or Flexbox. Submit a ZIP of your project folder.',
        rubric: [['Semantic HTML', 25], ['Responsive layout', 35], ['Accessibility', 25], ['Code quality', 15]] },
      { id: 'a4', courseId: 'c-mai600', title: 'Ethics Reflection', due: day(-6), points: 50, submitType: 'text', published: true,
        instructions: 'In 400–500 words, reflect on one ethics case study from Module 3. What went wrong, who was affected, and what would you have done differently?',
        rubric: [['Understanding of the case', 20], ['Critical reflection', 20], ['Clarity', 10]] },
      { id: 'a5', courseId: 'c-ict220', title: 'Accessibility Audit', due: day(9), points: 100, submitType: 'both', published: true,
        instructions: 'Audit a public website against WCAG 2.2 Level AA. Report five issues with screenshots, the success criterion each one fails, and a suggested fix.',
        rubric: [['Issues identified', 40], ['Correct WCAG references', 30], ['Recommendations', 30]] },
      { id: 'a6', courseId: 'c-cyb230', title: 'Phishing Awareness Poster', due: day(4), points: 50, submitType: 'file', published: true,
        instructions: 'Design a poster that teaches staff how to spot a phishing email.', rubric: [['Accuracy', 25], ['Design', 25]] }
    ];

    var submissions = [
      { id: 's1', assignmentId: 'a3', studentId: 'u-stu-1', submittedAt: day(-4, 16, 20), files: [{ name: 'landing-page.zip', size: '2.1 MB' }], text: '', receipt: 'PLMS-7Q2K-4410',
        grade: { score: 86, feedback: 'Great use of CSS Grid and a clean, semantic structure. To push this higher, add visible focus styles and check colour contrast on the hero buttons.', gradedAt: day(-1, 10, 5), gradedBy: 'u-lec-1' } },
      { id: 's2', assignmentId: 'a4', studentId: 'u-stu-1', submittedAt: day(-7, 21, 45), files: [], text: 'The case study I chose was the automated recruiting tool that learned to prefer male candidates…', receipt: 'PLMS-3MRT-9921', grade: null },
      { id: 's3', assignmentId: 'a3', studentId: 'u-stu-3', submittedAt: day(-3, 22, 10), files: [{ name: 'taylor-landing.zip', size: '1.7 MB' }], text: '', receipt: 'PLMS-8HHA-1022', grade: null },
      { id: 's4', assignmentId: 'a3', studentId: 'u-stu-4', submittedAt: day(-5, 11, 0), files: [{ name: 'riya_project.zip', size: '2.6 MB' }], text: '', receipt: 'PLMS-2PLW-5531', grade: { score: 92, feedback: 'Excellent — strong accessibility work throughout.', gradedAt: day(-1, 9, 40), gradedBy: 'u-lec-1' } },
      { id: 's5', assignmentId: 'a4', studentId: 'u-stu-2', submittedAt: day(-6, 18, 30), files: [], text: 'I reflected on the facial recognition case study…', receipt: 'PLMS-5TYU-3301', grade: null },
      { id: 's6', assignmentId: 'a4', studentId: 'u-stu-4', submittedAt: day(-6, 20, 5), files: [], text: 'My chosen case is the credit-limit algorithm…', receipt: 'PLMS-0KJD-7765', grade: { score: 44, feedback: 'Thoughtful reflection with clear recommendations.', gradedAt: day(-2, 14, 0), gradedBy: 'u-lec-1' } },
      { id: 's7', assignmentId: 'a1', studentId: 'u-stu-2', submittedAt: day(-1, 13, 15), files: [{ name: 'proposal-sam.docx', size: '84 KB' }], text: '', receipt: 'PLMS-6GGE-2208', grade: null }
    ];

    var announcements = [
      { id: 'n1', courseId: 'c-mai600', title: 'Assignment 1 drop-in session this Thursday', body: 'I will run a drop-in session on Thursday at 2pm in Room 4.02 to help with your AI Use-Case Proposals. Bring a draft outline and any questions.', date: day(-1, 9, 30), authorId: 'u-lec-1', pinned: true },
      { id: 'n2', courseId: 'c-ict220', title: 'Feedback released for the Landing Page assignment', body: 'Marks and feedback are now available under Assignments. Please read the feedback before starting the Accessibility Audit.', date: day(-1, 10, 10), authorId: 'u-lec-1', pinned: false },
      { id: 'n3', courseId: 'c-bus210', title: 'Q3 sales dataset updated', body: 'A corrected version of the Q3 sales dataset has been uploaded to Module 2. Please download the new file before starting your dashboard.', date: day(-2, 15, 0), authorId: 'u-lec-2', pinned: false },
      { id: 'n4', courseId: null, title: 'Welcome to Perception LMS', body: 'Perception LMS is ASA College\'s new learning platform. You can find your modules, submit assignments and check your grades all in one place. Contact the IT help desk if you have any trouble signing in.', date: day(-8, 8, 0), authorId: 'u-adm-1', pinned: false }
    ];

    // Lessons already completed by the demo student.
    var progress = { 'u-stu-1': { l1: true, l2: true, l3: true, l4: true, l5: true, l10: true, l14: true, l15: true, l16: true, l17: true } };

    // Study minutes per day (last 7 days, oldest first) for the activity chart.
    var activity = { 'u-stu-1': [45, 80, 30, 95, 60, 20, 70] };

    return { version: 1, users: users, courses: courses, enrolments: enrolments, assignments: assignments, submissions: submissions, announcements: announcements, progress: progress, activity: activity, nextId: 100 };
  }

  window.PerceptionSeed = seed;
})();
