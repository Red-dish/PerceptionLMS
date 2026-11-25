import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { Empty, ErrorNote } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';

function QuestionAnswer({ question, number, answer, onAnswer }) {
  const { id, type, points, text, options } = question;
  return (
    <fieldset className="card p-4 min-w-0">
      <legend className="px-1 text-sm font-semibold">Question {number} · {points} points</legend>
      {type === 'short_answer' ? (
        <label className="block space-y-2">
          <span className="block whitespace-pre-wrap break-words">{text}</span>
          <textarea className="input border-slate-500" rows={4} maxLength={5000} value={answer ?? ''} onChange={(event) => onAnswer(id, event.target.value)} />
        </label>
      ) : (
        <>
          <p className="font-medium whitespace-pre-wrap break-words mb-3" id={`question-${id}`}>{text}</p>
          <div className="space-y-2" role="group" aria-labelledby={`question-${id}`}>
            {type === 'multiple_choice' ? options.map((option) => {
              const selected = answer ?? [];
              return (
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3" key={option.id}>
                  <input type="checkbox" className="mt-1" checked={selected.includes(option.id)} onChange={(event) => onAnswer(id, event.target.checked ? [...selected, option.id] : selected.filter((value) => value !== option.id))} />
                  <span className="min-w-0 break-words">{option.text}</span>
                </label>
              );
            }) : [true, false].map((value) => (
              <label key={String(value)} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <input type="radio" name={id} checked={answer === value} onChange={() => onAnswer(id, value)} />
                {value ? 'True' : 'False'}
              </label>
            ))}
          </div>
        </>
      )}
    </fieldset>
  );
}

function AttemptResult({ attempt }) {
  return (
    <div className="card p-4 space-y-2">
      <h3 className="font-semibold">Attempt {attempt.number} submitted</h3>
      {attempt.auto_submitted && <p className="text-sm">Time ran out. Your saved answers were submitted.</p>}
      {attempt.needs_marking > 0 && <p className="text-sm">Waiting for your lecturer to finish marking.</p>}
      {attempt.score != null
        ? <p className="text-sm">Score: {attempt.score}/{attempt.max_score}</p>
        : <p className="text-sm">Your score will appear when marking is complete and the score is released.</p>}
      {attempt.results && attempt.questions.length > 0 && (
        <ol className="space-y-2 border-t border-slate-200 pt-2 text-sm">
          {attempt.questions.map((question, index) => {
            const result = attempt.results[question.id];
            const correctOptions = question.options?.filter((option) => option.correct).map((option) => option.text);
            const correctAnswer = correctOptions?.length ? correctOptions.join(', ')
              : question.answer != null ? (question.answer ? 'True' : 'False')
                : question.accepted_answers?.join(', ');
            return (
              <li key={question.id} className="break-words">
                <span className="font-medium">{index + 1}. {question.text}</span>
                {result && <p>{result.needs_marking ? 'Awaiting marking' : `${result.points}/${result.max_points} points`}</p>}
                {correctAnswer && <p>Correct answer: {correctAnswer}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function ActiveAttempt({ attempt, path, onFinished }) {
  const [answers, setAnswers] = useState(attempt.answers);
  const latest = useRef(attempt.answers);
  const queue = useRef(Promise.resolve());
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [saveError, setSaveError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  // Use the server's time remaining and a monotonic clock so wall-clock changes cannot extend the timer.
  const [expires] = useState(() => attempt.seconds_left == null ? null : performance.now() + attempt.seconds_left * 1000);
  const [seconds, setSeconds] = useState(attempt.seconds_left);
  const attemptPath = `${path}/attempts/${attempt.id}`;

  const submit = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setSubmitError(null);
    try {
      // Keep the final write behind any autosave so older answers cannot overtake submission.
      await queue.current;
      let result;
      try {
        result = await api.post(`${attemptPath}/submit`, { answers: latest.current });
      } catch (problem) {
        if (problem.status !== 409) throw problem;
        result = await api.get(attemptPath);
        if (result.status === 'in_progress') throw problem;
      }
      onFinished(result);
    } catch (problem) {
      setSubmitError(problem);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }, [attemptPath, onFinished]);

  useEffect(() => {
    if (expires === null) return undefined;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((expires - performance.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) {
        window.clearInterval(interval);
        submit();
      }
    };
    const interval = window.setInterval(tick, 250);
    tick();
    return () => window.clearInterval(interval);
  }, [expires, submit]);

  function saveAnswer(id, answer) {
    if (submitting.current || (expires !== null && performance.now() >= expires)) return;
    latest.current = { ...latest.current, [id]: answer };
    setAnswers(latest.current);
    setSaveStatus('Saving…');
    // Send a fresh snapshot when the previous write completes. Keeping the snapshot ensures
    // an unsaved answer is included again if an earlier request failed.
    const previous = queue.current;
    const write = (async () => {
      await previous;
      if (queue.current !== write || submitting.current) return;
      try {
        await api.put(`${attemptPath}/answers`, { answers: latest.current });
        setSaveError(null);
        if (queue.current === write) setSaveStatus('Answers saved.');
      } catch (problem) {
        setSaveError(problem);
        setSaveStatus('');
      }
    })();
    queue.current = write;
  }

  return (
    <section className="space-y-4" aria-label="Quiz attempt">
      <header className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Attempt {attempt.number}</h2>
        {seconds !== null && (
          <div role="timer" aria-live="off" className={`flex items-center gap-2 tabular-nums font-semibold ${seconds <= 60 ? 'text-red-700' : 'text-slate-700'}`}>
            <Clock size={18} aria-hidden="true" />
            Time left {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </div>
        )}
      </header>
      <fieldset disabled={busy || seconds === 0} className="space-y-4 min-w-0">
        {attempt.questions.map((question, index) => (
          <QuestionAnswer key={question.id} number={index + 1} question={question} answer={answers[question.id]} onAnswer={saveAnswer} />
        ))}
      </fieldset>
      <p role="status" className="text-sm text-slate-600">{saveStatus}</p>
      <ErrorNote error={saveError} />
      <ErrorNote error={submitError} onRetry={submit} />
      <div className="flex flex-wrap items-center gap-3">
        {!confirming && seconds !== 0 && <button type="button" className="btn-primary" disabled={busy} onClick={() => setConfirming(true)}>Submit quiz</button>}
        {confirming && seconds !== 0 && (
          <>
            <p className="text-sm">Submit this attempt? You won’t be able to change your answers.</p>
            <button type="button" className="btn-primary" disabled={busy} onClick={submit}>Confirm submission</button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>Keep working</button>
          </>
        )}
        {busy && <p role="status" className="text-sm">Submitting attempt…</p>}
      </div>
    </section>
  );
}

export default function QuizTaking({ quiz, path, reload }) {
  const [active, setActive] = useState(null);
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const attempts = quiz.my_attempts ?? [];
  const inProgress = attempts.find((attempt) => attempt.status === 'in_progress');

  const finish = useCallback(async (attempt) => {
    setReview(attempt);
    await reload();
    setActive(null);
  }, [reload]);

  async function open(attemptId) {
    setBusy(true);
    setError(null);
    try {
      const attempt = attemptId
        ? await api.get(`${path}/attempts/${attemptId}`)
        : await api.post(`${path}/attempts`);
      if (attempt.status === 'in_progress') {
        setReview(null);
        setActive(attempt);
      } else {
        setReview(attempt);
        await reload();
      }
    } catch (problem) {
      setError(problem);
      if ([403, 409].includes(problem.status)) await reload();
    } finally {
      setBusy(false);
    }
  }

  if (active) return <ActiveAttempt key={active.id} attempt={active} path={path} onFinished={finish} />;

  return (
    <section className="space-y-4" aria-label="Taking the quiz">
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">Quiz overview</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div><dt className="text-slate-600">Questions</dt><dd className="font-semibold">{quiz.question_count}</dd></div>
          <div><dt className="text-slate-600">Time limit</dt><dd className="font-semibold">{quiz.time_limit_minutes == null ? 'None' : `${quiz.time_limit_minutes} minutes`}</dd></div>
          <div><dt className="text-slate-600">Attempts left</dt><dd className="font-semibold">{quiz.attempts_left ?? 'Unlimited'}</dd></div>
        </dl>
        {quiz.can_start
          ? <button type="button" className="btn-primary" disabled={busy} onClick={() => open(inProgress?.id)}>{inProgress ? 'Resume attempt' : 'Start quiz'}</button>
          : <Empty>{quiz.question_count ? 'No new attempt is available.' : 'This quiz has no questions yet.'}</Empty>}
        <ErrorNote error={error} />
      </div>

      {review && <AttemptResult attempt={review} />}
      {attempts.some((attempt) => attempt.status !== 'in_progress') && (
        <section className="space-y-2" aria-labelledby="quiz-history">
          <h2 id="quiz-history" className="font-semibold">Attempt history</h2>
          <ul className="card divide-y divide-slate-200">
            {attempts.filter((attempt) => attempt.status !== 'in_progress').map((attempt) => (
              <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>Attempt {attempt.number} · {formatDateTime(attempt.submitted_at)}{attempt.score != null && ` · ${attempt.score}/${attempt.max_score}`}</span>
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => open(attempt.id)}>Review attempt {attempt.number}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
