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
      CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
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
    await t.test('RPG history survives deletion and undo, includes subtasks, and reopening reverses completion', async () => {
      await asUser(owner);
      const done = snapshot('rpg-done', 'Private title', [{ id: 'rpg-sub', task_id: 'rpg-done', title: 'Secret', completed: true }]);
      done.task.completed = true;
      done.task.status = 'completed';
      await save([done]);
      await save([{ action: 'delete', id: done.id }]);
      assert.deepEqual((await db.query("SELECT completed,completed_subtasks,pomodoros,deleted FROM rpg_task_history WHERE task_id='rpg-done'")).rows,
        [{ completed: true, completed_subtasks: 1, pomodoros: 2, deleted: true }]);
      await save([done]);
      assert.equal((await db.query("SELECT * FROM rpg_task_history WHERE task_id='rpg-done'")).rows.length, 1);
      done.task.completed = false;
      done.task.status = 'todo';
      await save([done]);
      assert.deepEqual((await db.query("SELECT completed,deleted FROM rpg_task_history WHERE task_id='rpg-done'")).rows, [{ completed: false, deleted: false }]);
    });
    await t.test('RPG history preserves tasks completed and deleted entirely offline', async () => {
      await asUser(owner);
      const done = snapshot('offline-rpg', 'Offline');
      done.task.completed = true;
      await save([{ ...done, action: 'delete' }]);
      assert.equal((await db.query("SELECT * FROM tasks WHERE id='offline-rpg'")).rows.length, 0);
      assert.deepEqual((await db.query("SELECT completed,deleted FROM rpg_task_history WHERE task_id='offline-rpg'")).rows, [{ completed: true, deleted: true }]);
      await save([{ ...done, action: 'delete' }]);
      assert.equal((await db.query("SELECT * FROM rpg_task_history WHERE task_id='offline-rpg'")).rows.length, 1);
    });
    await t.test('only members can read group history; clients cannot forge rewards or execute triggers', async () => {
      await asUser(outsider);
      assert.equal((await db.query('SELECT * FROM rpg_task_history')).rows.length, 0);
      await asUser(member);
      assert.ok((await db.query('SELECT * FROM rpg_task_history')).rows.length > 0);
      assert.equal((await db.query("UPDATE rpg_task_history SET pomodoros=999 RETURNING task_id")).rows.length, 0);
      await assert.rejects(db.query('SELECT private.capture_task_rpg()'), /permission denied/);
    });
    await t.test('missions preserve their name, stages and completion date through deletion and replay', async () => {
      await asUser(owner);
      const base = snapshot('mission-cnh', 'Tirar CNH', [
        { id: 'cnh-theory', task_id: 'mission-cnh', title: 'Prova teórica', completed: true },
        { id: 'cnh-practice', task_id: 'mission-cnh', title: 'Prova prática', completed: false },
      ]);
      const mission = { ...base, task: { ...base.task, kind: 'mission', completed_at: '2026-10-01T18:00:00Z' } };
      await save([mission]);
      assert.deepEqual((await db.query("SELECT kind,mission_title,total_subtasks,completed_subtasks FROM rpg_task_history WHERE task_id='mission-cnh'")).rows,
        [{ kind: 'mission', mission_title: 'Tirar CNH', total_subtasks: 2, completed_subtasks: 1 }]);
      mission.task.completed = true;
      await assert.rejects(save([mission]), /Conclua todas as etapas/);
      mission.subtasks[1] = { id: 'cnh-practice', task_id: 'mission-cnh', title: 'Prova prática', completed: true };
      await save([mission]);
      await save([{ ...mission, action: 'delete' }]);
      await save([{ ...mission, action: 'delete' }]);
      const result = await db.query<{ mission_title: string; total_subtasks: number; completed_subtasks: number; completed_at: Date }>("SELECT mission_title,total_subtasks,completed_subtasks,completed_at FROM rpg_task_history WHERE task_id='mission-cnh'");
      assert.equal(result.rows.length, 1);
      assert.equal(result.rows[0].mission_title, 'Tirar CNH');
      assert.equal(result.rows[0].total_subtasks, 2);
      assert.equal(result.rows[0].completed_subtasks, 2);
      assert.equal(result.rows[0].completed_at.toISOString(), '2026-10-01T18:00:00.000Z');
      await save([mission]);
      mission.task.completed = false;
      mission.subtasks[1] = { id: 'cnh-practice', task_id: 'mission-cnh', title: 'Prova prática', completed: false };
      await save([mission]);
      assert.equal((await db.query<{ completed: boolean }>("SELECT completed FROM rpg_task_history WHERE task_id='mission-cnh'")).rows[0].completed, false);
      await assert.rejects(save([{ ...mission, subtasks: [] }]), /pelo menos uma etapa/);
      await asUser(outsider);
      assert.equal((await db.query("SELECT * FROM rpg_task_history WHERE task_id='mission-cnh'")).rows.length, 0);
    });
    await t.test('planning and ordered stage details persist; completed author cannot be forged', async () => {
      await asUser(owner);
      const planned = snapshot('planned', 'Planned', [{ id: 'planned-step', task_id: 'planned', title: 'Stage', completed: true, notes: 'Evidence', due_date: '2026-10-09', position: 2, completed_by: outsider }]);
      Object.assign(planned.task, { planning: { recurrence: 'weekly', assigned_to: member } });
      await save([planned]);
      assert.deepEqual((await db.query("SELECT notes,due_date::text,position,completed_by FROM public.subtasks WHERE id='planned-step'")).rows, [{ notes: 'Evidence', due_date: '2026-10-09', position: 2, completed_by: owner }]);
      Object.assign(planned.task, { planning: { assigned_to: outsider } });
      await assert.rejects(save([planned]), /responsável/);
      assert.equal((await db.query<{ planning: { recurrence: string } }>("SELECT planning FROM public.tasks WHERE id='planned'")).rows[0].planning.recurrence, 'weekly');
    });
    await t.test('comments require group access and the real author, outsiders cannot read or post', async () => {
      await asUser(member);
      await db.query('INSERT INTO public.task_comments(task_id,author_id,body) VALUES ($1,$2,$3)', ['planned', member, 'Minha atualização']);
      await assert.rejects(db.query('INSERT INTO public.task_comments(task_id,author_id,body) VALUES ($1,$2,$3)', ['planned', owner, 'Forged']), /row-level/);
      await asUser(outsider);
      assert.equal((await db.query('SELECT * FROM public.task_comments')).rows.length, 0);
      await assert.rejects(db.query('INSERT INTO public.task_comments(task_id,author_id,body) VALUES ($1,$2,$3)', ['planned', outsider, 'Outside']), /row-level/);
    });
    await t.test('push config and dispatcher are unavailable to users; subscriptions are scoped', async () => {
      await asUser(owner);
      await assert.rejects(db.query('SELECT public.get_push_config()'), /permission denied/);
      await assert.rejects(db.query('SELECT public.claim_push_reminders()'), /permission denied/);
      await assert.rejects(db.query("INSERT INTO public.push_subscriptions(user_id,endpoint,p256dh,auth,timezone) VALUES ($1,'https://fcm.googleapis.com/test','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','aaaaaaaaaaaaaaaaaaaaaa','Invalid/TZ')", [owner]), /Fuso/);
      await assert.rejects(db.query("INSERT INTO public.push_subscriptions(user_id,endpoint,p256dh,auth) VALUES ($1,'https://localhost/private','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','aaaaaaaaaaaaaaaaaaaaaa')", [owner]), /check constraint/);
      await db.query("INSERT INTO public.push_subscriptions(user_id,endpoint,p256dh,auth,timezone) VALUES ($1,'https://fcm.googleapis.com/test','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','aaaaaaaaaaaaaaaaaaaaaa','UTC')", [owner]);
      await asUser(outsider);
      assert.equal((await db.query('SELECT * FROM public.push_subscriptions')).rows.length, 0);
      await db.exec('RESET ROLE');
      await db.query("UPDATE public.tasks SET due_date=(now() AT TIME ZONE 'UTC')::date,due_time=(now() AT TIME ZONE 'UTC')::time WHERE id='planned'");
      await db.exec('SET ROLE service_role');
      // Owner is not assigned to this task: no reminder is claimed.
      assert.deepEqual((await db.query<{ result: unknown[] }>('SELECT public.claim_push_reminders() result')).rows[0].result, []);
      await db.exec('RESET ROLE');
      await db.query("UPDATE public.tasks SET planning='{}'::jsonb WHERE id='planned'");
      await db.exec('SET ROLE service_role');
      assert.equal((await db.query<{ result: unknown[] }>('SELECT public.claim_push_reminders() result')).rows[0].result.length, 1);
      assert.deepEqual((await db.query<{ result: unknown[] }>('SELECT public.claim_push_reminders() result')).rows[0].result, []);
      await db.query("UPDATE public.push_deliveries SET delivered=true");
      assert.deepEqual((await db.query<{ result: unknown[] }>('SELECT public.claim_push_reminders() result')).rows[0].result, []);
    });
    await t.test('deleting a group cascades its history without recreating orphan rewards', async () => {
      await asUser(owner);
      await db.query('DELETE FROM groups WHERE id=$1', [group]);
      assert.equal((await db.query('SELECT * FROM rpg_task_history WHERE group_id=$1', [group])).rows.length, 0);
    });
  } finally { await db.close(); }
});
