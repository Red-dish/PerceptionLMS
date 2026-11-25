import { useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { ErrorNote, Loading } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useLoad } from '../../lib/useLoad';
import QuizBuilder from './QuizBuilder';
import QuizSettings from './QuizSettings';
import QuizTaking from './QuizTaking';

function QuizHeading({ title, subtitle }) {
  const heading = useRef(null);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} · Perception LMS`;
    heading.current.focus({ preventScroll: true });
    return () => { document.title = previousTitle; };
  }, [title]);

  return (
    <header>
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold text-slate-900 break-words">{title}</h1>
      {subtitle && <p className="text-sm text-slate-600 mt-1">{subtitle}</p>}
    </header>
  );
}

export function NewQuiz() {
  const { course, canEdit } = useOutletContext();
  const navigate = useNavigate();
  const list = `/courses/${course.id}/assignments`;
  if (!canEdit) return <Navigate to={list} replace />;
  return (
    <div className="space-y-4">
      <Link to={list} className="link text-sm">Back to assignments</Link>
      <QuizHeading title="New quiz" />
      <div className="card max-w-xl p-4 sm:p-6">
        <QuizSettings assignmentsPath={list} onSaved={(quiz) => navigate(`${list}/${quiz.id}`, { replace: true })} />
      </div>
    </div>
  );
}

export default function QuizDetail({ assignmentsPath, quizPath, canEdit, legacy, legacySubmissions }) {
  const { data, loading, error, reload } = useLoad(async () => {
    const quiz = await api.get(quizPath);
    const attempts = canEdit && quiz.question_count > 0 ? await api.get(`${quizPath}/attempts`) : [];
    return { quiz, locked: attempts.length > 0 };
  }, [quizPath, canEdit]);

  if (legacy && !canEdit && (error?.status === 404 || data?.quiz.question_count === 0)) return legacy;

  return (
    <div className="space-y-4">
      <Link to={assignmentsPath} className="link text-sm">Back to assignments</Link>
      {loading && !data && <Loading label="Loading quiz…" />}
      <ErrorNote error={error} onRetry={reload} />
      {data && (
        <>
          <QuizHeading title={data.quiz.title} subtitle={`Quiz · Due ${formatDateTime(data.quiz.due_at)} · ${data.quiz.published ? 'Published' : 'Draft'}`} />
          {data.quiz.instructions && <p className="whitespace-pre-wrap break-words text-sm">{data.quiz.instructions}</p>}
          {canEdit
            ? <QuizBuilder quiz={data.quiz} path={quizPath} assignmentsPath={assignmentsPath} locked={data.locked} reload={reload} />
            : <QuizTaking quiz={data.quiz} path={quizPath} reload={reload} />}
          {legacy && canEdit && data.quiz.question_count === 0 && <details className="card p-4"><summary className="cursor-pointer font-semibold">Assignment submissions</summary><div className="pt-4">{legacySubmissions}</div></details>}
        </>
      )}
      {legacy && canEdit && error?.status === 404 && legacy}
    </div>
  );
}
