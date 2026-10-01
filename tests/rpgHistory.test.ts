import test from 'node:test';
import assert from 'node:assert/strict';
import { stageTaskChanges } from '../src/utils/taskPersistence';
import { readRpgHistory, mergeRpgHistory, rewardSnapshot, parseRpgHistory } from '../src/utils/rpgHistory';
import { calculateRpgStats } from '../src/utils/rpgService';
import { loadContextTodos, migrateGuestTasksToCloud, type StorageLike } from '../src/utils/todoStorage';
import type { TodoItem } from '../src/types/todo';

class Memory implements StorageLike {
  data = new Map<string, string>([['apptodo_tasks_guest', '[]']]);
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}
const done: TodoItem = { id: 'mission', title: 'Private title', description: 'Private description', createdAt: '2026-10-01', pinned: false,
  priority: 'medium', category: 'work', completed: true, pomodoros: 1, subTasks: [{ id: 'sub', title: 'Secret', completed: true }] };

test('guest deletion preserves rewards, focus and badges after reloading; undo does not duplicate them', () => {
  const storage = new Memory();
  stageTaskChanges(null, null, [done], [done], [], storage);
  stageTaskChanges(null, null, [], [], [done.id], storage);
  const history = readRpgHistory(null, null, storage);
  const stats = calculateRpgStats(history);
  assert.equal(stats.totalXp, 60);
  assert.equal(stats.pomodoroFocusMinutes, 25);
  assert.equal(stats.badges.length, 0);
  assert.equal(JSON.stringify(history).includes('Private'), false);
  stageTaskChanges(null, null, [done], [done], [], storage);
  assert.equal(calculateRpgStats(mergeRpgHistory(history, loadContextTodos(null, null, storage).todos)).totalXp, 60);
});

test('reopening reverses completion XP, retains focus, and allows a single new completion', () => {
  const history = [rewardSnapshot(done)];
  const reopened = { ...done, completed: false };
  assert.equal(calculateRpgStats(mergeRpgHistory(history, [reopened])).totalXp, 0);
  assert.equal(calculateRpgStats(mergeRpgHistory(history, [reopened])).pomodoroFocusMinutes, 25);
  assert.equal(calculateRpgStats(mergeRpgHistory(history, [done, done])).totalXp, 60);
});

test('guest, accounts and group histories remain isolated', () => {
  const storage = new Memory();
  stageTaskChanges('alice', 'team', [done], [done], [], storage);
  stageTaskChanges('alice', 'team', [], [], [done.id], storage);
  assert.equal(readRpgHistory('alice', 'team', storage).length, 1);
  assert.equal(readRpgHistory('alice', null, storage).length, 0);
  assert.equal(readRpgHistory('bob', 'team', storage).length, 0);
  assert.equal(readRpgHistory(null, null, storage).length, 0);
});

test('unfinished tasks count focus minutes without granting completion XP or generic achievements', () => {
  const stats = calculateRpgStats([{ ...done, completed: false, pomodoros: 5 }]);
  assert.equal(stats.totalXp, 0);
  assert.equal(stats.pomodoroFocusMinutes, 125);
  assert.equal(stats.badges.length, 0);
});

test('guest login migrates archived reward evidence even when the visible task list is empty', async () => {
  const storage = new Memory();
  stageTaskChanges(null, null, [done], [done], [], storage);
  stageTaskChanges(null, null, [], [], [done.id], storage);
  const changes: Array<{ action: string; task: { completed: boolean; title: string } }> = [];
  const result = await migrateGuestTasksToCloud('account', { async rpc(_name, args) {
    changes.push(...args.p_changes as typeof changes);
    return { error: null };
  } }, storage);
  assert.equal(result.success, true);
  assert.equal(changes[0].action, 'delete');
  assert.equal(changes[0].task.completed, true);
  assert.equal(changes[0].task.title.includes('Private'), false);
  assert.equal(readRpgHistory(null, null, storage).length, 0);
});

test('corrupt reward cache cannot crash statistics or inject malformed records', () => {
  assert.deepEqual(parseRpgHistory('{broken'), []);
  assert.deepEqual(parseRpgHistory(JSON.stringify([null, { ...rewardSnapshot(done), subTasks: [null] }, { ...rewardSnapshot(done), pomodoros: -1 }])), []);
  assert.equal(parseRpgHistory(JSON.stringify([rewardSnapshot(done)])).length, 1);
});


test('guest login preserves completed mission names and dates after removal', async () => {
  const storage = new Memory();
  const mission: TodoItem = { ...done, kind: 'mission', title: 'Tirar CNH', completedAt: '2026-10-01T18:00:00Z' };
  stageTaskChanges(null, null, [mission], [mission], [], storage);
  stageTaskChanges(null, null, [], [], [mission.id], storage);
  const changes: Array<{ task: { kind: string; title: string; completed_at: string } }> = [];
  const result = await migrateGuestTasksToCloud('account', { async rpc(_name, args) {
    changes.push(...args.p_changes as typeof changes);
    return { error: null };
  } }, storage);
  assert.equal(result.success, true);
  assert.equal(changes[0].task.kind, 'mission');
  assert.equal(changes[0].task.title, 'Tirar CNH');
  assert.equal(changes[0].task.completed_at, '2026-10-01T18:00:00Z');
});
