import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flushTaskChanges, stageTaskChanges, type TaskTransport } from '../src/utils/taskPersistence';
import { loadSyncQueue, loadContextTodos, mergeCloudTasksWithLocal, restoreTodoInContext, migrateGuestTasksToCloud, GUEST_STORAGE_KEY, type StorageLike } from '../src/utils/todoStorage';
import { joinGroup } from '../src/utils/groupService';
import type { TodoItem } from '../src/types/todo';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const task: TodoItem = {
  id: 'task', title: 'Original', completed: true, status: 'completed', priority: 'high',
  category: 'work', pinned: true, createdAt: '2026-09-24T12:00:00Z',
  completedAt: '2026-09-24T14:00:00Z', pomodoros: 3, order: 4,
  subTasks: [{ id: 'sub', title: 'Passo', completed: true }],
};

test('cloud-only tasks survive an empty local cache', () => {
  assert.deepEqual(mergeCloudTasksWithLocal([], [task], []).map(t => t.id), ['task']);
  const skewedClock = { ...task, title: 'Old cached edit', updatedAt: '2099-01-01' };
  assert.equal(mergeCloudTasksWithLocal([skewedClock], [task], [])[0].title, task.title);
});

test('an old response never acknowledges or overwrites a newer edit', async () => {
  const storage = new MemoryStorage();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  const sent: Record<string, unknown>[] = [];
  const client: TaskTransport = { async rpc(_name, args) {
    sent.push(args);
    if (++calls === 1) await gate;
    return { error: null };
  } };
  stageTaskChanges('edit-user', null, [task], [task], [], storage);
  const first = flushTaskChanges(client, 'edit-user', null, storage);
  const edited = { ...task, title: 'New edit', subTasks: [] };
  stageTaskChanges('edit-user', null, [edited], [edited], [], storage);
  assert.equal(flushTaskChanges(client, 'edit-user', null, storage), first);
  release();
  await first;
  assert.equal(calls, 2);
  assert.equal(loadSyncQueue('edit-user', null, storage).length, 0);
  assert.equal(loadContextTodos('edit-user', null, storage).todos[0].title, 'New edit');
  assert.equal(loadContextTodos('edit-user', null, storage).todos[0].syncState, 'synced');
  assert.deepEqual((sent[1].p_changes as Array<{ subtasks: unknown[] }>)[0].subtasks, []);
});

test('failed batch retains all upserts and deletions; retry uses one atomic RPC', async () => {
  const storage = new MemoryStorage();
  stageTaskChanges('batch-user', 'group', [task], [task], ['old-task'], storage);
  await assert.rejects(flushTaskChanges({ rpc: async () => ({ error: { message: 'offline' } }) }, 'batch-user', 'group', storage), /offline/);
  assert.equal(loadSyncQueue('batch-user', 'group', storage).length, 2);
  let calls = 0;
  await flushTaskChanges({ async rpc(name, args) {
    calls++;
    assert.equal(name, 'apply_task_changes');
    assert.equal(args.p_group_id, 'group');
    const changes = args.p_changes as Array<{ action: string; task: { pomodoros: number; completed_at: string } }>;
    assert.equal(changes.length, 2);
    assert.equal(changes[0].task.pomodoros, 3);
    assert.equal(changes[0].task.completed_at, task.completedAt);
    assert.equal(changes[1].action, 'delete');
    return { error: null };
  } }, 'batch-user', 'group', storage);
  assert.equal(calls, 1);
  assert.equal(loadSyncQueue('batch-user', 'group', storage).length, 0);
});

test('undo keeps identity, order, completion, subtasks and focus history', () => {
  const restored = restoreTodoInContext([], task, 0);
  assert.deepEqual(restored, [task]);
  assert.equal(restoreTodoInContext(restored, task, 0).length, 1);
  const storage = new MemoryStorage();
  stageTaskChanges('undo-user', null, [], [], [task.id], storage);
  stageTaskChanges('undo-user', null, restored, [task], [], storage);
  assert.deepEqual(loadSyncQueue('undo-user', null, storage).map(op => [op.action, op.task]), [['upsert', task]]);
});

test('invite service sends the SQL argument and unwraps success; rejects unsuccessful JSON', async () => {
  const group = { id: 'group', name: 'Team', color: '#5b4fe9', inviteCode: 'TODO-ABC234', createdBy: 'owner', createdAt: '2026-09-24' };
  assert.deepEqual(await joinGroup({ async rpc(name, args) {
    assert.equal(name, 'join_group_by_code');
    assert.deepEqual(args, { p_code: 'TODO-ABC234' });
    return { data: { success: true, group }, error: null };
  } }, 'TODO-ABC234'), group);
  await assert.rejects(joinGroup({ rpc: async () => ({ data: { success: false, message: 'Convite inválido' }, error: null }) }, 'bad'), /Convite inválido/);
});

test('guest migration retries the same IDs, preserves account cache and cannot change accounts mid-flight', async () => {
  const storage = new MemoryStorage();
  storage.setItem(GUEST_STORAGE_KEY, JSON.stringify([task]));
  const first = await migrateGuestTasksToCloud('migration-user', { rpc: async () => ({ error: { message: 'offline' } }) }, storage);
  assert.equal(first.success, false);
  const pending = loadSyncQueue('migration-user', null, storage);
  assert.equal(pending.length, 1);
  assert.notEqual(pending[0].taskId, task.id);
  const other = await migrateGuestTasksToCloud('other-user', { rpc: async () => { throw new Error('Must not send'); } }, storage);
  assert.equal(other.success, false);
  const success = await migrateGuestTasksToCloud('migration-user', { async rpc(_name, args) {
    assert.equal((args.p_changes as Array<{ id: string }>)[0].id, pending[0].taskId);
    return { error: null };
  } }, storage);
  assert.equal(success.success, true);
  assert.equal(storage.getItem(GUEST_STORAGE_KEY), '[]');
  assert.equal(loadContextTodos('migration-user', null, storage).todos.length, 1);
});

test('storage failure is surfaced before any cloud request or false local success', () => {
  const storage: StorageLike = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.throws(() => stageTaskChanges('quota-user', null, [task], [task], [], storage), /fila/);
});
