import test from 'node:test';
import assert from 'node:assert/strict';
import type { TodoItem } from '../src/types/todo';
import { calculateRpgStats } from '../src/utils/rpgService';
import { mergeRpgHistory, rewardSnapshot } from '../src/utils/rpgHistory';
import { sanitizeTaskUpdates, toggleSubTaskInTask } from '../src/utils/taskDomain';
import { generateBackupData, validateAndParseBackupFile } from '../src/utils/backupService';

const mission: TodoItem = { id: 'books', kind: 'mission', title: 'Ler dez livros', category: 'study', priority: 'medium',
  completed: false, createdAt: '2026-10-01', pinned: false,
  subTasks: Array.from({ length: 10 }, (_, i) => ({ id: String(i), title: `Livro ${i + 1}`, completed: false })) };

test('only explicitly chosen missions create personal achievements; existing tasks stay ordinary', () => {
  const ordinary = { ...mission, kind: undefined, completed: true };
  const stats = calculateRpgStats([ordinary, mission]);
  assert.equal(stats.badges.length, 1);
  assert.equal(stats.badges[0].title, 'Ler dez livros');
  assert.equal(stats.badges[0].unlocked, false);
  assert.deepEqual(stats.badges[0].progress, { current: 0, total: 10 });
  assert.equal(stats.totalXp, 30);
});

test('ten stages award one named achievement; reopening a stage withdraws it', () => {
  let current = mission;
  for (let i = 0; i < 10; i++) {
    current = toggleSubTaskInTask(current, String(i), '2026-10-01T18:00:00Z').updatedTask;
    assert.equal(current.completed, i === 9);
    assert.deepEqual(calculateRpgStats([current]).badges[0].progress, { current: i + 1, total: 10 });
  }
  const history = [rewardSnapshot(current)];
  const achieved = calculateRpgStats(mergeRpgHistory(history, [])).badges[0];
  assert.equal(achieved.unlocked, true);
  assert.equal(achieved.title, mission.title);
  assert.equal(achieved.unlockedAt, '2026-10-01T18:00:00Z');
  assert.equal(calculateRpgStats(mergeRpgHistory(history, [current])).badges.length, 1);
  current = toggleSubTaskInTask(current, '0').updatedTask;
  assert.equal(calculateRpgStats(mergeRpgHistory(history, [current])).badges[0].unlocked, false);
});

test('editing completed missions with an unfinished stage reopens them; empty missions are rejected', () => {
  const completed = { ...mission, completed: true, status: 'completed' as const, subTasks: mission.subTasks.map(s => ({ ...s, completed: true })) };
  const result = sanitizeTaskUpdates({ subTasks: [...completed.subTasks, { id: 'new', title: 'Outro livro', completed: false }] }, completed);
  assert.equal(result.cleanUpdates.completed, false);
  assert.equal(result.cleanUpdates.status, 'in_progress');
  assert.throws(() => sanitizeTaskUpdates({ subTasks: [] }, mission), /pelo menos uma etapa/);
});

test('backups preserve mission type and stages', () => {
  const imported = validateAndParseBackupFile(generateBackupData([mission]));
  assert.equal(imported.valid, true);
  assert.equal(imported.todos[0].kind, 'mission');
  assert.equal(imported.todos[0].subTasks.length, 10);
});
