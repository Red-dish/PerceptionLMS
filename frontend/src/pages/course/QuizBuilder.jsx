import { useState } from 'react';
import { Empty, ErrorNote } from '../../components/ui';
import { api } from '../../lib/api';
import QuizSettings from './QuizSettings';

const types = {
  multiple_choice: 'Multiple choice',
  true_false: 'True or false',
  short_answer: 'Short answer',
};
const emptyOption = () => ({ text: '', correct: false });

function QuestionEditor({ question, locked, path, onSaved, onCancel }) {
  const [type, setType] = useState(question?.type ?? 'multiple_choice');
  const [text, setText] = useState(question?.text ?? '');
  const [points, setPoints] = useState(question?.points ?? 1);
  const [options, setOptions] = useState(question?.options ?? [emptyOption(), emptyOption()]);
  const [answer, setAnswer] = useState(question?.answer ?? true);
  const [accepted, setAccepted] = useState(question?.accepted_answers?.join('\n') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const wordingOnly = locked || error?.status === 409;
  const changeOption = (index, changes) => setOptions((current) => current.map((option, i) => i === index ? { ...option, ...changes } : option));

  async function submit(event) {
    event.preventDefault();
    const body = { text: text.trim() };
    if (!body.text) {
      setError('Enter the question text.');
      return;
    }
    if (!wordingOnly) {
      body.points = Number(points);
      if (!question) body.type = type;
      if (type === 'multiple_choice') {
        body.options = options.map((option) => ({ text: option.text.trim(), correct: option.correct }));
        if (body.options.some((option) => !option.text) || !body.options.some((option) => option.correct)) {
          setError('Fill in all options and select at least one correct answer.');
          return;
        }
      }
      if (type === 'true_false') body.answer = answer;
      if (type === 'short_answer') {
        body.accepted_answers = accepted.split('\n').map((line) => line.trim()).filter(Boolean);
      }
    }
    setBusy(true);
    try {
      if (question) await api.patch(`${path}/${question.id}`, body);
      else await api.post(path, body);
      await onSaved();
    } catch (problem) {
      setError(problem);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card p-4" onSubmit={submit}>
      <fieldset className="space-y-3 min-w-0" disabled={busy}>
        <legend className="font-semibold mb-3">{question ? 'Edit question' : 'Add question'}</legend>
        {!question && (
          <label className="block">
            <span className="label">Question type</span>
            <select className="input border-slate-500" value={type} onChange={(event) => setType(event.target.value)}>
              {Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        )}
        <label className="block">
          <span className="label">Question text</span>
          <textarea className="input border-slate-500" required maxLength={5000} rows={3} value={text} onChange={(event) => setText(event.target.value)} />
        </label>
        {!wordingOnly && (
          <>
            <label className="block max-w-32">
              <span className="label">Points</span>
              <input className="input border-slate-500" type="number" required min={0} max={100} value={points} onChange={(event) => setPoints(event.target.value)} />
            </label>
            {type === 'multiple_choice' && (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">Select the checkbox beside each correct option.</p>
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input type="checkbox" aria-label={`Option ${index + 1} is correct`} checked={option.correct} onChange={(event) => changeOption(index, { correct: event.target.checked })} />
                    <input className="input border-slate-500 min-w-0" required maxLength={1000} aria-label={`Option ${index + 1}`} value={option.text} onChange={(event) => changeOption(index, { text: event.target.value })} />
                    <button type="button" className="btn-ghost" aria-label={`Remove option ${index + 1}`} disabled={options.length <= 2} onClick={() => setOptions(options.filter((_, i) => i !== index))}>Remove</button>
                  </div>
                ))}
                <button type="button" className="btn-ghost" disabled={options.length >= 10} onClick={() => setOptions([...options, emptyOption()])}>Add option</button>
              </div>
            )}
            {type === 'true_false' && (
              <label className="block">
                <span className="label">Correct answer</span>
                <select className="input border-slate-500" value={String(answer)} onChange={(event) => setAnswer(event.target.value === 'true')}>
                  <option value="true">True</option><option value="false">False</option>
                </select>
              </label>
            )}
            {type === 'short_answer' && (
              <label className="block">
                <span className="label">Accepted answers (optional, one per line)</span>
                <textarea className="input border-slate-500" rows={3} value={accepted} onChange={(event) => setAccepted(event.target.value)} />
              </label>
            )}
          </>
        )}
        <ErrorNote error={error} />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary" disabled={wordingOnly && !question}>{busy ? 'Saving…' : 'Save question'}</button>
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </fieldset>
    </form>
  );
}

export default function QuizBuilder({ quiz, path, assignmentsPath, locked, reload }) {
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const questions = quiz.questions ?? [];
  const questionPath = `${path}/questions`;
  const isLocked = locked || error?.status === 409;

  async function change(operation) {
    setBusy(true);
    setError(null);
    try {
      await operation();
      setDeleteId(null);
      await reload();
    } catch (problem) {
      setError(problem);
    } finally {
      setBusy(false);
    }
  }

  function move(index, offset) {
    const questionIds = questions.map(({ id }) => id);
    const [id] = questionIds.splice(index, 1);
    questionIds.splice(index + offset, 0, id);
    change(() => api.put(`${questionPath}/order`, { question_ids: questionIds }));
  }

  function questionEditor(question) {
    return (
      <QuestionEditor
        key={question?.id ?? 'new'}
        question={question}
        locked={isLocked}
        path={questionPath}
        onCancel={() => setEditor(null)}
        onSaved={async () => { setEditor(null); await reload(); }}
      />
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] items-start">
      <section className="space-y-3 min-w-0" aria-labelledby="quiz-questions">
        <div className="flex flex-wrap justify-between gap-2 items-center">
          <div>
            <h2 id="quiz-questions" className="text-lg font-semibold">Questions</h2>
            <p className="text-sm text-slate-600">{questions.length} questions · {questions.length ? quiz.max_mark : 0} points</p>
          </div>
          <button type="button" className="btn-primary" disabled={isLocked || busy || editor !== null} onClick={() => setEditor('new')}>Add question</button>
        </div>
        {isLocked && <p className="card p-3 text-sm">Students have started this quiz. You can still edit question wording.</p>}
        <ErrorNote error={error} />
        {!questions.length && editor !== 'new' && <Empty>Add a question before students can start the quiz.</Empty>}
        <ol className="space-y-3">
          {questions.map((question, index) => (
            <li key={question.id} className="min-w-0">
              {editor === question.id ? questionEditor(question) : (
                <article className="card p-4 space-y-3">
                  <div>
                    <p className="text-sm text-slate-600">{types[question.type]} · {question.points} points</p>
                    <h3 className="font-semibold whitespace-pre-wrap break-words">{index + 1}. {question.text}</h3>
                  </div>
                  {question.options && (
                    <ul className="space-y-1 text-sm">
                      {question.options.map((option) => <li key={option.id} className="break-words">{option.text}{option.correct && <span className="ml-2 text-emerald-700">Correct</span>}</li>)}
                    </ul>
                  )}
                  {question.type === 'true_false' && <p className="text-sm">Correct answer: {question.answer ? 'True' : 'False'}</p>}
                  {question.type === 'short_answer' && (
                    <p className="text-sm break-words">{question.accepted_answers?.length ? `Accepted answers: ${question.accepted_answers.join(', ')}` : 'Marked manually'}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-ghost" disabled={busy || editor !== null} aria-label={`Edit question ${index + 1}`} onClick={() => setEditor(question.id)}>Edit</button>
                    {!isLocked && (
                      <>
                        <button type="button" className="btn-ghost" disabled={busy || index === 0 || editor !== null} aria-label={`Move question ${index + 1} up`} onClick={() => move(index, -1)}>Move up</button>
                        <button type="button" className="btn-ghost" disabled={busy || index === questions.length - 1 || editor !== null} aria-label={`Move question ${index + 1} down`} onClick={() => move(index, 1)}>Move down</button>
                        <button type="button" className="btn-ghost text-red-700" disabled={busy || editor !== null} aria-label={`Delete question ${index + 1}`} onClick={() => setDeleteId(question.id)}>Delete</button>
                      </>
                    )}
                  </div>
                  {deleteId === question.id && !isLocked && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span>Delete this question?</span>
                      <button type="button" className="btn-ghost text-red-700" disabled={busy} onClick={() => change(() => api.del(`${questionPath}/${question.id}`))}>Confirm delete</button>
                      <button type="button" className="btn-ghost" disabled={busy} onClick={() => setDeleteId(null)}>Cancel</button>
                    </div>
                  )}
                </article>
              )}
            </li>
          ))}
        </ol>
        {editor === 'new' && questionEditor()}
      </section>
      <section className="card p-4 min-w-0">
        <QuizSettings assignmentsPath={assignmentsPath} quiz={quiz} onSaved={reload} />
      </section>
    </div>
  );
}
