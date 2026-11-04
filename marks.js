// PROTOTYPE: the "Viewing as" switch stands in for a real login, and marks are kept in this
// browser's localStorage. Anyone can open the browser tools and read all of it, so this does
// NOT meet SEC-02/SEC-05 yet. A server must check the logged-in user before returning marks.

const STORAGE_KEY = 'studenthub.marks.v1';
const USER_KEY = 'studenthub.marks.user';

const DEMO_DATA = {
  lecturers: [
    { id: 'L01', name: 'Dr. Sarah Mitchell' },
    { id: 'L02', name: 'Prof. Michael Chen' },
    { id: 'L03', name: 'Dr. Emily Roberts' }
  ],
  students: [
    { id: 'S1001', name: 'Jamie Carter', program: 'Computer Science' },
    { id: 'S1002', name: 'Priya Sharma', program: 'Computer Science' },
    { id: 'S1003', name: 'Liam Nguyen', program: 'Information Technology' },
    { id: 'S1004', name: 'Olivia Brown', program: 'Computer Science' },
    { id: 'S1005', name: 'Noah Williams', program: 'Information Technology' }
  ],
  courses: [
    {
      id: 'cs301', code: 'CS 301', name: 'Web Development', lecturerId: 'L01',
      enrolled: ['S1001', 'S1002', 'S1003', 'S1004', 'S1005'],
      assessments: [
        { id: 'cs301-a1', name: 'HTML & CSS Quiz', max: 20, weight: 15 },
        { id: 'cs301-a2', name: 'Responsive Portfolio', max: 25, weight: 35 },
        { id: 'cs301-a3', name: 'Final Exam', max: 100, weight: 50 }
      ]
    },
    {
      id: 'cs240', code: 'CS 240', name: 'Database Systems', lecturerId: 'L02',
      enrolled: ['S1001', 'S1002', 'S1003', 'S1005'],
      assessments: [
        { id: 'cs240-a1', name: 'ER Diagram', max: 30, weight: 20 },
        { id: 'cs240-a2', name: 'Normalization Exercise', max: 15, weight: 30 },
        { id: 'cs240-a3', name: 'SQL Project', max: 50, weight: 50 }
      ]
    },
    {
      id: 'cs220', code: 'CS 220', name: 'Data Structures & Algorithms', lecturerId: 'L03',
      enrolled: ['S1001', 'S1003', 'S1004', 'S1005'],
      assessments: [
        { id: 'cs220-a1', name: 'Linked Lists Lab', max: 30, weight: 25 },
        { id: 'cs220-a2', name: 'Binary Trees Lab', max: 30, weight: 25 },
        { id: 'cs220-a3', name: 'Final Exam', max: 100, weight: 50 }
      ]
    }
  ],
  marks: {
    cs301: {
      S1001: { 'cs301-a1': 17, 'cs301-a2': 21, 'cs301-a3': 81 },
      S1002: { 'cs301-a1': 19, 'cs301-a2': 24, 'cs301-a3': 90 },
      S1003: { 'cs301-a1': 12, 'cs301-a2': 15, 'cs301-a3': 58 },
      S1004: { 'cs301-a1': 9, 'cs301-a2': 11, 'cs301-a3': 40 },
      S1005: { 'cs301-a1': 15, 'cs301-a2': 18 }
    },
    cs240: {
      S1001: { 'cs240-a1': 24, 'cs240-a2': 12 },
      S1002: { 'cs240-a1': 27, 'cs240-a2': 13, 'cs240-a3': 41 },
      S1003: { 'cs240-a1': 20, 'cs240-a2': 9 }
    },
    cs220: {
      S1001: { 'cs220-a1': 26, 'cs220-a2': 25, 'cs220-a3': 74 },
      S1003: { 'cs220-a1': 22, 'cs220-a2': 20, 'cs220-a3': 66 },
      S1004: { 'cs220-a1': 18, 'cs220-a2': 16, 'cs220-a3': 51 },
      S1005: { 'cs220-a1': 28, 'cs220-a2': 27 }
    }
  },
  lastSaved: {}
};

const sidebar = document.getElementById('sidebar');
const menuButton = document.getElementById('menuButton');
const userSelect = document.getElementById('demoUser');
const view = document.getElementById('marksView');
const toast = document.getElementById('toast');
const searchInput = document.getElementById('globalSearch');

let data = loadData();
let currentUser = null;
let selectedCourseId = null;
let draft = {};
let hasUnsavedChanges = false;

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (error) {
    // Storage blocked or corrupted: fall back to the demo data
  }
  return copy(DEMO_DATA);
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    return false;
  }
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

// Builds elements with textContent (never innerHTML) so names can't inject HTML (SEC-06)
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatNumber(value) {
  return String(roundTo(value, 2));
}

function initials(name) {
  return name.replace(/^(Dr|Prof)\.\s*/, '').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

function statCard(icon, colour, label, value, note) {
  const card = el('article', 'stat-card');
  const copyBlock = el('div');
  copyBlock.append(el('span', '', label), el('strong', '', value), el('small', '', note));
  card.append(el('div', `stat-icon ${colour}`, icon), copyBlock);
  return card;
}

function gradeBadge(result) {
  if (!result.complete) return el('span', 'grade-badge grade-pending', 'In progress');
  const badge = el('span', `grade-badge grade-${result.grade.grade}`, result.grade.grade);
  badge.title = result.grade.label;
  return badge;
}

function panelHeading(title, subtitle) {
  const heading = el('div', 'panel-heading');
  const text = el('div');
  text.append(el('h2', '', title), el('p', '', subtitle));
  heading.append(text);
  return heading;
}

function gradeScalePanel() {
  const panel = el('article', 'panel scale-panel');
  panel.append(panelHeading('Grade scale', 'Final mark rounded to a whole number'));
  const list = el('ul', 'scale-list');
  GRADE_SCALE.forEach((band, index) => {
    const upper = index === 0 ? 100 : GRADE_SCALE[index - 1].min - 1;
    const item = el('li');
    item.append(gradeBadge({ complete: true, grade: band }), el('span', '', band.label), el('b', '', `${band.min}–${upper}`));
    list.append(item);
  });
  const note = el('p', 'scale-note', 'Final mark = sum of (score ÷ max × weight) for each assessment. A grade is shown once every assessment is marked.');
  panel.append(list, note);
  return panel;
}

function emptyPanel(message) {
  const panel = el('article', 'panel empty-panel');
  panel.append(el('p', '', message));
  return panel;
}

function updateProfile() {
  document.getElementById('profileAvatar').textContent = initials(currentUser.name);
  document.getElementById('profileName').textContent = currentUser.name;
  document.getElementById('profileRole').textContent = currentUser.role === 'lecturer' ? 'Lecturer' : currentUser.program;
}

function buildUserSelect() {
  userSelect.replaceChildren();
  [['Lecturers', 'lecturer', data.lecturers], ['Students', 'student', data.students]].forEach(([label, role, people]) => {
    const group = el('optgroup');
    group.label = label;
    people.forEach(person => {
      const option = el('option', '', person.name);
      option.value = `${role}:${person.id}`;
      group.append(option);
    });
    userSelect.append(group);
  });
}

function setUser(value) {
  const [role, id] = value.split(':');
  const people = role === 'lecturer' ? data.lecturers : data.students;
  const person = people.find(p => p.id === id) || data.lecturers[0];
  currentUser = { role: people.includes(person) ? role : 'lecturer', ...person };
  userSelect.value = `${currentUser.role}:${currentUser.id}`;
  try { localStorage.setItem(USER_KEY, userSelect.value); } catch (error) { /* optional */ }
  selectedCourseId = null;
  updateProfile();
  render();
}

function confirmDiscard() {
  return !hasUnsavedChanges || confirm('You have unsaved marks. Discard them?');
}

function render() {
  hasUnsavedChanges = false;
  searchInput.value = '';
  if (currentUser.role === 'lecturer') renderLecturerView();
  else renderStudentView();
}

/* ---------- Lecturer: enter and update marks ---------- */

function renderLecturerView() {
  document.getElementById('marksTitle').textContent = 'Enter marks';
  document.getElementById('marksSubtitle').textContent = 'Enter or update marks for the courses you teach, then save.';

  // Lecturers only see courses assigned to them
  const courses = data.courses.filter(course => course.lecturerId === currentUser.id);
  if (!courses.length) {
    view.replaceChildren(emptyPanel('You are not assigned to any courses yet.'));
    return;
  }
  if (!courses.some(course => course.id === selectedCourseId)) selectedCourseId = courses[0].id;
  const course = courses.find(c => c.id === selectedCourseId);
  draft = copy(data.marks[course.id] || {});

  const stats = el('div', 'stats-grid');
  stats.id = 'lecturerStats';

  const panel = el('article', 'panel marks-panel');
  const heading = panelHeading(`${course.code} · ${course.name}`, `${course.enrolled.length} students · ${course.assessments.length} assessments`);
  const courseSelect = el('select', 'field-select');
  courseSelect.setAttribute('aria-label', 'Choose course');
  courses.forEach(c => {
    const option = el('option', '', `${c.code} ${c.name}`);
    option.value = c.id;
    courseSelect.append(option);
  });
  courseSelect.value = course.id;
  courseSelect.addEventListener('change', () => {
    if (!confirmDiscard()) { courseSelect.value = selectedCourseId; return; }
    selectedCourseId = courseSelect.value;
    render();
  });
  heading.append(courseSelect);
  panel.append(heading);

  if (totalWeight(course.assessments) !== 100) {
    panel.append(el('p', 'weight-warning', `Assessment weights add up to ${totalWeight(course.assessments)}%, not 100%. Grades can't be calculated until this is fixed.`));
  }

  const wrap = el('div', 'marks-table-wrap');
  const table = el('table', 'marks-table');
  const headRow = el('tr');
  headRow.append(el('th', '', 'Student'));
  course.assessments.forEach(assessment => {
    const th = el('th');
    th.append(el('span', '', assessment.name), el('small', '', `out of ${assessment.max} · ${assessment.weight}%`));
    headRow.append(th);
  });
  headRow.append(el('th', '', 'Final'), el('th', '', 'Grade'));
  const head = el('thead');
  head.append(headRow);
  table.append(head);

  const body = el('tbody');
  course.enrolled.forEach(studentId => {
    const student = data.students.find(s => s.id === studentId);
    if (!student) return;
    const row = el('tr', 'searchable');
    row.dataset.search = `${student.name} ${student.id}`.toLowerCase();

    const nameCell = el('td', 'student-cell');
    nameCell.append(el('strong', '', student.name), el('small', '', student.id));
    row.append(nameCell);

    course.assessments.forEach(assessment => {
      const cell = el('td');
      const input = el('input', 'score-input');
      input.type = 'number';
      input.min = '0';
      input.max = String(assessment.max);
      input.step = 'any';
      input.inputMode = 'decimal';
      input.setAttribute('aria-label', `${student.name}, ${assessment.name}, out of ${assessment.max}`);
      const saved = draft[student.id]?.[assessment.id];
      if (saved !== undefined && saved !== null) input.value = saved;
      input.addEventListener('input', () => onScoreInput(input, course, student, assessment, row));
      cell.append(input, el('span', 'score-max', `/${assessment.max}`));
      row.append(cell);
    });

    row.append(el('td', 'final-cell'), el('td', 'grade-cell'));
    updateRow(row, course, student.id);
    body.append(row);
  });
  table.append(body);
  wrap.append(table);
  panel.append(wrap);

  const footer = el('div', 'marks-footer');
  const status = el('span', 'save-status');
  status.id = 'saveStatus';
  const actions = el('div', 'marks-actions');
  const discardButton = el('button', 'secondary-button', 'Discard changes');
  discardButton.type = 'button';
  discardButton.addEventListener('click', () => { if (confirmDiscard()) render(); });
  const saveButton = el('button', 'primary-button', 'Save marks');
  saveButton.type = 'button';
  saveButton.addEventListener('click', () => saveCourseMarks(course));
  actions.append(discardButton, saveButton);
  footer.append(status, actions);
  panel.append(footer);

  const layout = el('section', 'marks-grid');
  layout.append(panel, gradeScalePanel());
  view.replaceChildren(stats, layout);
  updateLecturerStats(course);
  updateSaveStatus(course);
}

function readScore(input, max) {
  if (input.validity.badInput) return { valid: false, score: null };
  if (input.value.trim() === '') return { valid: true, score: null };
  const score = Number(input.value);
  return { valid: isValidScore(score, max), score };
}

function onScoreInput(input, course, student, assessment, row) {
  const { valid, score } = readScore(input, assessment.max);
  input.classList.toggle('invalid', !valid);
  input.title = valid ? '' : `Enter a number from 0 to ${assessment.max}`;
  input.setAttribute('aria-invalid', String(!valid));

  draft[student.id] = draft[student.id] || {};
  if (valid && score !== null) draft[student.id][assessment.id] = score;
  else delete draft[student.id][assessment.id];

  hasUnsavedChanges = true;
  updateRow(row, course, student.id);
  updateLecturerStats(course);
  updateSaveStatus(course);
}

function updateRow(row, course, studentId) {
  const result = calculateResult(course.assessments, draft[studentId]);
  const finalCell = row.querySelector('.final-cell');
  finalCell.textContent = result.complete
    ? `${result.finalMark}%`
    : `${formatNumber(result.percent)}% of ${formatNumber(result.assessedWeight)}%`;
  finalCell.title = result.complete ? `Exact: ${formatNumber(result.percent)}%` : 'Marks so far, out of the weight marked so far';
  row.querySelector('.grade-cell').replaceChildren(gradeBadge(result));
}

function updateLecturerStats(course) {
  const results = course.enrolled.map(id => calculateResult(course.assessments, draft[id]));
  const complete = results.filter(result => result.complete);
  const average = complete.length ? `${Math.round(complete.reduce((sum, r) => sum + r.finalMark, 0) / complete.length)}%` : '—';
  const passRate = complete.length ? `${Math.round((complete.filter(r => r.grade.grade !== 'F').length / complete.length) * 100)}%` : '—';
  document.getElementById('lecturerStats').replaceChildren(
    statCard('▦', 'purple', 'Students enrolled', String(course.enrolled.length), course.code),
    statCard('✓', 'coral', 'Fully marked', `${complete.length}/${results.length}`, `${results.length - complete.length} still in progress`),
    statCard('◎', 'cyan', 'Class average', average, 'Fully marked students'),
    statCard('★', 'gold', 'Pass rate', passRate, 'P grade or above')
  );
}

function updateSaveStatus(course) {
  const status = document.getElementById('saveStatus');
  const last = data.lastSaved?.[course.id];
  status.classList.toggle('unsaved', hasUnsavedChanges);
  if (hasUnsavedChanges) status.textContent = 'Unsaved changes';
  else if (last) status.textContent = `Last saved by ${last.by}, ${new Date(last.at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}`;
  else status.textContent = 'Showing demo marks';
}

function saveCourseMarks(course) {
  // Mirrors the check a server must do: only the assigned lecturer may change marks
  if (currentUser.role !== 'lecturer' || course.lecturerId !== currentUser.id) {
    showToast('You can only change marks for your own courses.', true);
    return;
  }
  const firstInvalid = view.querySelector('.score-input.invalid');
  if (firstInvalid) {
    firstInvalid.focus();
    showToast('Fix the highlighted marks before saving.', true);
    return;
  }
  const previous = data.marks[course.id];
  const previousSave = data.lastSaved?.[course.id];
  data.marks[course.id] = copy(draft);
  data.lastSaved = data.lastSaved || {};
  data.lastSaved[course.id] = { by: currentUser.name, at: new Date().toISOString() };
  if (!saveData()) {
    data.marks[course.id] = previous;
    data.lastSaved[course.id] = previousSave;
    showToast('Could not save. Browser storage is unavailable.', true);
    return;
  }
  hasUnsavedChanges = false;
  updateSaveStatus(course);
  showToast('Marks saved');
}

/* ---------- Student: view own marks only ---------- */

// Reads only the logged-in student's marks, never the whole class
function getOwnMarks(courseId) {
  return data.marks[courseId]?.[currentUser.id] || {};
}

function renderStudentView() {
  document.getElementById('marksTitle').textContent = 'My marks';
  document.getElementById('marksSubtitle').textContent = 'Your results for each course. Only you can see these.';

  const enrolled = data.courses.filter(course => course.enrolled.includes(currentUser.id));
  if (!enrolled.length) {
    view.replaceChildren(emptyPanel('You are not enrolled in any courses yet.'));
    return;
  }
  const results = enrolled.map(course => ({ course, marks: getOwnMarks(course.id), result: calculateResult(course.assessments, getOwnMarks(course.id)) }));
  const complete = results.filter(r => r.result.complete);
  const markedCount = results.reduce((sum, r) => sum + r.course.assessments.filter(a => isValidScore(r.marks[a.id], a.max)).length, 0);
  const totalCount = results.reduce((sum, r) => sum + r.course.assessments.length, 0);
  const average = complete.length ? `${Math.round(complete.reduce((sum, r) => sum + r.result.finalMark, 0) / complete.length)}%` : '—';

  const stats = el('div', 'stats-grid');
  stats.append(
    statCard('▦', 'purple', 'Courses enrolled', String(enrolled.length), 'This study period'),
    statCard('✓', 'coral', 'Courses completed', `${complete.length}/${enrolled.length}`, 'All assessments marked'),
    statCard('◎', 'cyan', 'Average final mark', average, 'Completed courses'),
    statCard('★', 'gold', 'Assessments marked', `${markedCount}/${totalCount}`, 'Across all courses')
  );

  const courseColumn = el('div', 'course-results');
  results.forEach(({ course, marks, result }) => courseColumn.append(studentCoursePanel(course, marks, result)));

  const layout = el('section', 'marks-grid');
  layout.append(courseColumn, gradeScalePanel());
  view.replaceChildren(stats, layout);
}

function studentCoursePanel(course, marks, result) {
  const lecturer = data.lecturers.find(l => l.id === course.lecturerId);
  const panel = el('article', 'panel searchable');
  panel.dataset.search = `${course.code} ${course.name}`.toLowerCase();
  const heading = panelHeading(course.name, `${course.code} · ${lecturer ? lecturer.name : 'Lecturer TBC'}`);
  heading.append(gradeBadge(result));
  panel.append(heading);

  const wrap = el('div', 'marks-table-wrap');
  const table = el('table', 'marks-table');
  const headRow = el('tr');
  ['Assessment', 'Weight', 'Score', 'Contribution'].forEach(label => headRow.append(el('th', '', label)));
  const head = el('thead');
  head.append(headRow);
  table.append(head);
  const body = el('tbody');
  course.assessments.forEach(assessment => {
    const score = marks[assessment.id];
    const marked = isValidScore(score, assessment.max);
    const row = el('tr');
    row.append(
      el('td', 'assessment-name', assessment.name),
      el('td', '', `${assessment.weight}%`),
      el('td', marked ? '' : 'muted-cell', marked ? `${formatNumber(score)} / ${assessment.max}` : 'Not marked yet'),
      el('td', marked ? '' : 'muted-cell', marked ? `${formatNumber((score / assessment.max) * assessment.weight)}%` : '—')
    );
    body.append(row);
  });
  table.append(body);
  wrap.append(table);
  panel.append(wrap);

  let summary;
  if (result.complete) summary = `Final mark ${result.finalMark}% · ${result.grade.label}`;
  else if (result.assessedWeight > 0) summary = `${formatNumber(result.assessedWeight)}% of this course has been marked. Your average on marked work is ${formatNumber(result.markedAverage)}%.`;
  else summary = 'No marks have been released yet.';
  panel.append(el('p', result.complete ? 'course-summary complete' : 'course-summary', summary));
  return panel;
}

/* ---------- Page setup ---------- */

menuButton.addEventListener('click', () => sidebar.classList.toggle('open'));

userSelect.addEventListener('change', () => {
  if (!confirmDiscard()) { userSelect.value = `${currentUser.role}:${currentUser.id}`; return; }
  setUser(userSelect.value);
});

document.getElementById('resetDemo').addEventListener('click', () => {
  if (!confirm('Reset all marks to the demo data?')) return;
  data = copy(DEMO_DATA);
  saveData();
  hasUnsavedChanges = false;
  buildUserSelect();
  setUser(`${currentUser.role}:${currentUser.id}`);
  showToast('Demo data restored');
});

searchInput.addEventListener('input', () => {
  const term = searchInput.value.trim().toLowerCase();
  document.querySelectorAll('.searchable').forEach(item => {
    item.classList.toggle('search-hidden', Boolean(term) && !item.dataset.search.includes(term));
  });
});

window.addEventListener('beforeunload', event => {
  if (hasUnsavedChanges) event.preventDefault();
});

document.getElementById('todayLabel').textContent = new Date().toLocaleDateString('en-AU', {
  weekday: 'long', day: 'numeric', month: 'long'
}).toUpperCase();

buildUserSelect();
let savedUser = 'lecturer:L01';
try { savedUser = localStorage.getItem(USER_KEY) || savedUser; } catch (error) { /* optional */ }
setUser(savedUser);
