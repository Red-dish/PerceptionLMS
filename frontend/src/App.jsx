import { Navigate, Outlet, Route, Routes, useOutletContext } from 'react-router-dom';
import Layout from './components/Layout';
import { Loading } from './components/ui';
import { useAuth } from './lib/auth';
import Assignments from './pages/course/Assignments';
import AssignmentDetail from './pages/course/AssignmentDetail';
import CourseHome from './pages/course/CourseHome';
import CourseLayout from './pages/course/CourseLayout';
import Gradebook from './pages/course/Gradebook';
import GradeSubmission from './pages/course/GradeSubmission';
import Modules from './pages/course/Modules';
import People from './pages/course/People';
import { NewQuiz } from './pages/course/QuizDetail';
import Courses from './pages/Courses';
import AssignmentsOverview from './pages/AssignmentsOverview';
import AnnouncementsHub from './pages/AnnouncementsHub';
import GradingHub from './pages/GradingHub';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import Grades from './pages/Grades';
import Login from './pages/Login';
import Users from './pages/Users';

function RequireSignIn() {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen grid place-items-center"><Loading /></div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

// This only hides pages. The API is what actually enforces each role.
function RequireRole({ role }) {
  const { user } = useAuth();
  const parentContext = useOutletContext();
  return user.role === role ? <Outlet context={parentContext} /> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireSignIn />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="grading" element={<GradingHub />} />
          <Route path="announcements" element={<AnnouncementsHub />} />
          <Route path="assignments" element={<AssignmentsOverview />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="courses" element={<Courses />} />
          <Route path="courses/:courseId" element={<CourseLayout />}>
            <Route index element={<CourseHome />} />
            <Route path="gradebook" element={<Gradebook />} />
            <Route path="modules" element={<Modules />} />
            <Route path="assignments" element={<Assignments />} />
            <Route path="assignments/new-quiz" element={<NewQuiz />} />
            <Route path="assignments/:assignmentId" element={<AssignmentDetail />} />
            <Route path="assignments/:assignmentId/submissions/:studentId" element={<GradeSubmission />} />
            <Route element={<RequireRole role="admin" />}>
              <Route path="people" element={<People />} />
            </Route>
          </Route>
          <Route element={<RequireRole role="student" />}>
            <Route path="grades" element={<Grades />} />
          </Route>
          <Route element={<RequireRole role="admin" />}>
            <Route path="users" element={<Users />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
