import test from 'node:test';
import assert from 'node:assert/strict';
import { nextOccurrence, isInView } from '../src/utils/planning';
import { transitionTaskStatus, toggleTaskCompleted, sanitizeTaskUpdates } from '../src/utils/taskDomain';
import { generateBackupData, validateAndParseBackupFile } from '../src/utils/backupService';
import { rewardSnapshot } from '../src/utils/rpgHistory';
import type { TodoItem } from '../src/types/todo';
import { prepareFullRestore } from '../src/utils/backupRestore';

const task: TodoItem = { id: 'read', title: 'Leitura', completed: false, createdAt: '2026-01-01T12:00:00Z', pinned: false, category: 'study', priority: 'medium', subTasks: [{ id: 'chapter', title: 'Capítulo', completed: false }] };

test('mission cannot bulk-complete from checkbox, Kanban or direct updates', () => {
  const mission = { ...task, kind: 'mission' as const };
  assert.throws(() => toggleTaskCompleted(mission), /cada etapa/);
  assert.throws(() => transitionTaskStatus(mission, 'completed'), /cada etapa/);
  assert.throws(() => sanitizeTaskUpdates({ completed: true }, mission), /cada etapa/);
  assert.equal(mission.subTasks[0].completed, false);
});
test('Today includes overdue pending tasks and excludes old completions and future tasks', () => {
  assert.equal(isInView({ ...task, dueDate: '2026-10-04' }, 'today', '2026-10-05'), true);
  assert.equal(isInView({ ...task, completed: true, dueDate: '2026-10-04' }, 'today', '2026-10-05'), false);
  assert.equal(isInView({ ...task, dueDate: '2026-10-06' }, 'today', '2026-10-05'), false);
});
test('daily and weekly recurrence crosses dates and resets all completion and focus evidence', () => {
  const done = { ...task, completed: true, dueDate: '2026-12-31', completedAt: '2026-12-31T18:00:00Z', pomodoros: 3, pomodoroSessionIds: ['old'], subTasks: task.subTasks.map(s => ({ ...s, completed: true, completedAt: '2026-12-31', completedBy: 'old' })) };
  const next = nextOccurrence({ ...done, recurrence: 'daily' })!;
  assert.equal(next.dueDate, '2027-01-01');
  assert.equal(next.completed, false); assert.equal(next.completedAt, undefined);
  assert.equal(next.subTasks[0].completedBy, undefined); assert.equal(next.pomodoros, 0);
  assert.deepEqual(next.pomodoroSessionIds, []);
  assert.equal(nextOccurrence({ ...done, recurrence: 'weekly' })!.dueDate, '2027-01-07');
  assert.equal(nextOccurrence({ ...done, recurrence: 'daily' })!.id, next.id);
});
test('monthly recurrence keeps the original day after short months; missions never repeat', () => {
  const january = { ...task, completed: true, dueDate: '2026-01-31', recurrence: 'monthly' as const };
  const february = nextOccurrence(january)!;
  assert.equal(february.dueDate, '2026-02-28');
  assert.equal(nextOccurrence({ ...february, completed: true })!.dueDate, '2026-03-31');
  assert.equal(nextOccurrence({ ...january, kind: 'mission' }), null);
  assert.equal(nextOccurrence({ ...january, completed: false }), null);
});
test('complete backup restores archived mission evidence and planning fields without account identifiers', () => {
  const mission = { ...task, id: 'cnh', kind: 'mission' as const, title: 'Minha CNH', completed: true, completedAt: '2026-10-05T12:00:00Z', subTasks: task.subTasks.map(s => ({ ...s, completed: true })) };
  const current = { ...task, recurrence: 'monthly' as const, recurrenceAnchorDay: 31, assignedTo: 'private-user', subTasks: [{ ...task.subTasks[0], notes: 'Notas da etapa', dueDate: '2026-10-08' }] };
  const json = generateBackupData([current], 'Pessoal', [rewardSnapshot(mission)]);
  assert.equal(json.includes('private-user'), false);
  const parsed = validateAndParseBackupFile(json);
  assert.equal(parsed.valid, true); assert.equal(parsed.todos[0].recurrenceAnchorDay, 31);
  assert.equal(parsed.todos[0].subTasks[0].notes, 'Notas da etapa');
  assert.equal(parsed.rewardHistory!.find(t => t.id === mission.id)!.title, 'Minha CNH');
  assert.equal(validateAndParseBackupFile(generateBackupData([], 'Pessoal', [rewardSnapshot(mission)])).valid, true);
  assert.equal(validateAndParseBackupFile(JSON.stringify({ todos: [], rewardHistory: [{ id: 'bad' }] })).valid, false);
});

test('importing a complete backup twice never duplicates active tasks or archived rewards, and never deletes an active task', () => {
  const archive = { ...rewardSnapshot(task), id: 'archived', completed: true };
  const first = prepareFullRestore([], [], [task], [archive], 'guest', null, 'merge');
  assert.equal(first.next.length, 1); assert.equal(first.newArchives.length, 1);
  const second = prepareFullRestore(first.next, first.archived, [task], [archive], 'guest', null, 'merge');
  assert.equal(second.next.length, 1); assert.equal(second.newArchives.length, 0);
  const reexported = prepareFullRestore(first.next, first.archived, first.next, first.archived, 'guest', null, 'merge');
  assert.equal(reexported.next.length, 1); assert.equal(reexported.newArchives.length, 0);
  const existing = prepareFullRestore([task], [rewardSnapshot(task)], [], [rewardSnapshot(task)], 'guest', null, 'merge');
  assert.equal(existing.archived.length, 0); assert.equal(existing.next[0].id, task.id);
  const other = prepareFullRestore([], [], [task], [archive], 'user:other', null, 'merge');
  assert.notEqual(other.next[0].id, first.next[0].id);
});

test('restoring a recurring series preserves the identity of the next occurrence', () => {
  const completed = { ...task, completed: true, recurrence: 'daily' as const, dueDate: '2026-10-05' };
  const successor = nextOccurrence(completed)!;
  const restored = prepareFullRestore([], [], [completed, successor], [rewardSnapshot(completed), rewardSnapshot(successor)], 'guest', null, 'replace');
  assert.equal(nextOccurrence(restored.next[0])!.id, restored.next[1].id);
  assert.equal(restored.archived.length, 0);
});
