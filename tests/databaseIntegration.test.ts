import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('real PostgreSQL migrations, permissions and atomic persistence', async t => {
  const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111';
  const member = '22222222-2222-4222-8222-222222222222';
  const outsider = '33333333-3333-4333-8333-333333333333';
  const group = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  try {
    await db.exec(`CREATE SCHEMA auth;
      CREATE ROLE authenticated; CREATE ROLE anon;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('test.user_id', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated, anon;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
      CREATE PUBLICATION supabase_realtime;
      INSERT INTO auth.users VALUES ('${owner}'),('${member}'),('${outsider}');`);
    for (const name of readdirSync('supabase/migrations').filter(n => n.endsWith('.sql')).sort()) {
      await db.exec(readFileSync(`supabase/migrations/${name}`, 'utf8'));
    }
    await db.exec('GRANT USAGE ON SCHEMA public TO authenticated, anon; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated, anon;');
    const asUser = async (id: string) => {
      await db.exec('RESET ROLE');
      await db.query("SELECT set_config('test.user_id', $1, false)", [id]);
      await db.exec('SET ROLE authenticated');
    };
    const save = (changes: unknown[], target: string | null = group) => db.query('SELECT public.apply_task_changes($1, $2::jsonb)', [target, JSON.stringify(changes)]);
    const snapshot = (id: string, title: string, subs: unknown[] = []) => ({
      action: 'upsert', id, task: { id, user_id: owner, group_id: group, title, completed: false,
        status: 'todo', priority: 'medium', category: 'work', pinned: false, pomodoros: 2,
        pomodoro_session_ids: [] as string[], order_index: 0, created_at: '2026-09-24T12:00:00Z' }, subtasks: subs,
    });
    await asUser(owner);
    await db.query('INSERT INTO public.groups(id,name,invite_code,created_by) VALUES ($1,$2,$3,$4)', [group, 'Team', 'TODO-ABC234', owner]);

    await t.test('group creation adds exactly one owner atomically', async () => {
      const { rows } = await db.query('SELECT role FROM public.group_members WHERE group_id=$1', [group]);
      assert.deepEqual(rows, [{ role: 'owner' }]);
    });
    await t.test('a guessed group ID cannot grant membership; valid invite can', async () => {
      await asUser(member);
      await assert.rejects(db.query("INSERT INTO public.group_members(group_id,user_id,role) VALUES ($1,$2,'owner')", [group, member]), /row-level security/);
      assert.equal((await db.query('SELECT * FROM public.groups')).rows.length, 0);
      const invalid = await db.query<{ result: { success: boolean } }>("SELECT join_group_by_code('TODO-WRONG1') AS result");
      assert.equal(invalid.rows[0].result.success, false);
      const valid = await db.query<{ result: { success: boolean; group: { id: string; role: string } } }>("SELECT join_group_by_code('TODO-ABC234') AS result");
      assert.equal(valid.rows[0].result.group.id, group);
      assert.equal(valid.rows[0].result.group.role, 'member');
      assert.equal((await db.query("UPDATE public.group_members SET role='owner' WHERE user_id=$1 RETURNING id", [member])).rows.length, 0);
    });
    await t.test('save includes subtasks; a failing replacement rolls back task and removed subtasks', async () => {
      await asUser(owner);
      await save([snapshot('task-a', 'Original', [{ id: 'sub-a', task_id: 'task-a', title: 'Keep me', completed: true }]), snapshot('task-b', 'Other', [{ id: 'occupied', task_id: 'task-b', title: 'Other sub', completed: false }])]);
      await assert.rejects(save([snapshot('task-a', 'Should roll back', [{ id: 'occupied', task_id: 'task-a', title: 'Conflict', completed: false }])]), /duplicate key/);
      assert.deepEqual((await db.query("SELECT title FROM public.tasks WHERE id='task-a'")).rows, [{ title: 'Original' }]);
      assert.deepEqual((await db.query("SELECT title FROM public.subtasks WHERE task_id='task-a'")).rows, [{ title: 'Keep me' }]);
      await save([snapshot('task-a', 'Updated', [])]);
      assert.equal((await db.query("SELECT * FROM public.subtasks WHERE task_id='task-a'")).rows.length, 0);
    });
    await t.test('member edits preserve author; moving data out of the group is denied', async () => {
      await asUser(member);
      const edit = snapshot('task-a', 'Member edit');
      edit.task.user_id = member;
      await save([edit]);
      assert.deepEqual((await db.query("SELECT user_id FROM public.tasks WHERE id='task-a'")).rows, [{ user_id: owner }]);
      await assert.rejects(db.query("UPDATE public.tasks SET group_id=NULL,user_id=$1 WHERE id='task-a'", [member]), /não podem/);
    });
    await t.test('outsider cannot read, write, delete, or enumerate member profiles', async () => {
      await asUser(outsider);
      assert.equal((await db.query('SELECT * FROM public.tasks')).rows.length, 0);
      assert.equal((await db.query('SELECT * FROM public.subtasks')).rows.length, 0);
      assert.equal((await db.query('SELECT * FROM public.list_group_members($1)', [group])).rows.length, 0);
      await assert.rejects(save([{ action: 'delete', id: 'task-a' }]), /Sem acesso/);
    });
    await t.test('replayed Pomodoro completion and profile counters are idempotent', async () => {
      await asUser(owner);
      const done = snapshot('task-a', 'Focus done');
      done.task.pomodoros = 3;
      done.task.pomodoro_session_ids = ['session-one'];
      done.task.completed = true;
      done.task.status = 'completed';
      await save([done]);
      await save([done]);
      assert.deepEqual((await db.query("SELECT pomodoros FROM public.tasks WHERE id='task-a'")).rows, [{ pomodoros: 3 }]);
      assert.deepEqual((await db.query('SELECT completed_tasks_count,focus_minutes FROM public.profiles WHERE id=$1', [owner])).rows,
        [{ completed_tasks_count: 1, focus_minutes: 125 }]);
    });
    await t.test('bulk replacement is atomic, and deletion undo restores the original ID', async () => {
      await asUser(owner);
      const original = snapshot('task-a', 'Restored');
      await save([{ action: 'delete', id: 'task-a' }]);
      await save([original]);
      assert.equal((await db.query("SELECT * FROM public.tasks WHERE id='task-a'")).rows.length, 1);
      await assert.rejects(save([{ action: 'delete', id: 'task-a' }, { action: 'unknown' }]), /desconhecida/);
      assert.equal((await db.query("SELECT * FROM public.tasks WHERE id='task-a'")).rows.length, 1);
    });
  } finally { await db.close(); }
});
