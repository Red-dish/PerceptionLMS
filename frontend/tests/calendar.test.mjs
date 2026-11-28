import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentStatus, dateKey, monthCells, sortByDue } from '../src/lib/calendar.js';

test('local date keys do not depend on UTC date string slicing', () => {
  assert.equal(dateKey(new Date(2026, 10, 25, 15)), '2026-11-25');
  assert.equal(dateKey('not-a-date'), null);
});

test('month grid starts on Monday and includes every day of the month', () => {
  const dates = monthCells(2026, 10);
  assert.equal(dates[0].getDay(), 1);
  assert.ok(dates.some((date) => date.getMonth() === 10 && date.getDate() === 1));
  assert.ok(dates.some((date) => date.getMonth() === 10 && date.getDate() === 30));
  assert.equal(dates.length % 7, 0);
});

test('student status tracks submitted work instead of calling it overdue', () => {
  const now = new Date(2026, 10, 25, 12);
  const past = { due_at: new Date(2026, 10, 24, 12).toISOString() };
  assert.equal(assignmentStatus(past, 'student', now), 'overdue');
  assert.equal(assignmentStatus({ ...past, my_submission: { id: 'submission-1' } }, 'student', now), 'submitted');
  assert.equal(assignmentStatus(past, 'lecturer', now), 'past');
  assert.equal(assignmentStatus({ ...past, kind: 'quiz' }, 'student', now), 'past');
  const future = { due_at: new Date(2026, 10, 27, 12).toISOString() };
  assert.equal(assignmentStatus(future, 'student', now), 'upcoming');
});

test('assignments are sorted by due date then title', () => {
  const input = [
    { id: 'a', title: 'Zebra', due_at: '2026-12-06T00:00:00Z' },
    { id: 'b', title: 'Alpha', due_at: '2026-12-05T00:00:00Z' },
    { id: 'c', title: 'Apple', due_at: '2026-12-06T00:00:00Z' },
  ];
  assert.deepEqual(sortByDue(input).map((a) => a.id), ['b', 'c', 'a']);
  assert.equal(input[0].id, 'a');
});
