import { Routes, Route, Navigate } from 'react-router-dom'; import { useAuth } from './auth';
import Layout from './components/Layout'; import Login from './pages/Login'; import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard'; import Courses from './pages/Courses'; import CourseLayout from './pages/CourseLayout';
import CourseHome from './pages/CourseHome'; import Modules from './pages/Modules'; import Lesson from './pages/Lesson'; import Assignments from './pages/Assignments';
import Grades from './pages/Grades'; import Attendance from './pages/Attendance'; import People from './pages/People'; import CourseSettings from './pages/CourseSettings';
import MyAttendance from './pages/MyAttendance'; import Users from './pages/Users'; import Calendar from './pages/Calendar';
const Private = ({ children }) => { const { user, loading } = useAuth(); if (loading) return <div className="h-screen grid place-items-center text-slate-500">Loading…</div>; return user ? children : <Navigate to="/login" />; };
export default function App() {
  return <Routes>
    <Route path="/login" element={<Login />} /><Route path="/auth/callback" element={<AuthCallback />} />
    <Route element={<Private><Layout /></Private>}>
      <Route index element={<Dashboard />} /><Route path="courses" element={<Courses />} /><Route path="attendance" element={<MyAttendance />} />
      <Route path="calendar" element={<Calendar />} /><Route path="users" element={<Users />} />
      <Route path="courses/:id" element={<CourseLayout />}>
        <Route index element={<CourseHome />} /><Route path="modules" element={<Modules />} /><Route path="lessons/:lid" element={<Lesson />} />
        <Route path="assignments" element={<Assignments />} /><Route path="grades" element={<Grades />} /><Route path="attendance" element={<Attendance />} />
        <Route path="people" element={<People />} /><Route path="settings" element={<CourseSettings />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" />} />
  </Routes>;
}
