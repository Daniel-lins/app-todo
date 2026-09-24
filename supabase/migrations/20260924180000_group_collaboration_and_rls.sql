-- Migration: 20260924180000_group_collaboration_and_rls.sql
-- Description: Implementação de RLS estrito para colaboração em grupos, resolução de recursão,
--              gatilho atômico de associação de proprietário, função RPC de entrada segura e
--              ativação do Supabase Realtime para tabelas colaborativas.

-- 1. Função auxiliar para obter IDs de grupos do usuário sem causar recursão infinita no RLS
CREATE OR REPLACE FUNCTION public.get_my_group_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT group_id FROM public.group_members WHERE user_id = auth.uid();
$$;

-- 2. Gatilho atômico para criação de grupo:
-- Garante que o criador do grupo seja associado imediatamente como 'owner' na mesma transação.
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'owner';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_group_created ON public.groups;
CREATE TRIGGER on_group_created
AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();

-- 3. Função RPC segura para entrar em grupos via código de convite:
-- Permite que usuários entrem pelo código sem expor a lista de todos os grupos do sistema.
CREATE OR REPLACE FUNCTION public.join_group_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_clean_code text;
  v_group record;
  v_existing_member record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Faça login para entrar em um grupo.');
  END IF;

  v_clean_code := UPPER(TRIM(p_code));
  IF v_clean_code = '' OR v_clean_code IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Código de convite inválido.');
  END IF;

  SELECT * INTO v_group FROM public.groups WHERE invite_code = v_clean_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Código de convite inválido ou grupo não encontrado.');
  END IF;

  SELECT * INTO v_existing_member FROM public.group_members
  WHERE group_id = v_group.id AND user_id = v_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Você já faz parte deste grupo! Grupo ativado.',
      'group', jsonb_build_object(
        'id', v_group.id,
        'name', v_group.name,
        'description', v_group.description,
        'color', v_group.color,
        'inviteCode', v_group.invite_code,
        'createdBy', v_group.created_by,
        'createdAt', v_group.created_at,
        'role', v_existing_member.role
      )
    );
  END IF;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group.id, v_user_id, 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Você entrou no grupo com sucesso!',
    'group', jsonb_build_object(
      'id', v_group.id,
      'name', v_group.name,
      'description', v_group.description,
      'color', v_group.color,
      'inviteCode', v_group.invite_code,
      'createdBy', v_group.created_by,
      'createdAt', v_group.created_at,
      'role', 'member'
    )
  );
END;
$$;

-- 4. Habilitação de REPLICA IDENTITY FULL para capturar payload completo em eventos de UPDATE e DELETE no Realtime
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.subtasks REPLICA IDENTITY FULL;
ALTER TABLE public.groups REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;

-- 5. Adição das tabelas à publicação supabase_realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'subtasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.subtasks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'groups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'group_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
  END IF;
END $$;

-- 6. Atualização das Políticas de Row Level Security (RLS)

-- RLS: groups
DROP POLICY IF EXISTS "groups_select" ON public.groups;
CREATE POLICY "groups_select" ON public.groups
  FOR SELECT USING (
    created_by = auth.uid() OR id IN (SELECT public.get_my_group_ids())
  );

DROP POLICY IF EXISTS "groups_insert" ON public.groups;
CREATE POLICY "groups_insert" ON public.groups
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND auth.uid() = created_by
  );

DROP POLICY IF EXISTS "groups_update" ON public.groups;
CREATE POLICY "groups_update" ON public.groups
  FOR UPDATE USING (
    auth.uid() = created_by
  );

DROP POLICY IF EXISTS "groups_delete" ON public.groups;
CREATE POLICY "groups_delete" ON public.groups
  FOR DELETE USING (
    auth.uid() = created_by
  );

-- RLS: group_members
DROP POLICY IF EXISTS "group_members_select" ON public.group_members;
CREATE POLICY "group_members_select" ON public.group_members
  FOR SELECT USING (
    user_id = auth.uid() OR group_id IN (SELECT public.get_my_group_ids())
  );

DROP POLICY IF EXISTS "group_members_insert" ON public.group_members;
CREATE POLICY "group_members_insert" ON public.group_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "group_members_delete" ON public.group_members;
CREATE POLICY "group_members_delete" ON public.group_members
  FOR DELETE USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.created_by = auth.uid()
    )
  );

-- RLS: tasks
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
CREATE POLICY "tasks_select_policy" ON public.tasks
  FOR SELECT USING (
    (group_id IS NULL AND user_id = auth.uid()) OR
    (group_id IS NOT NULL AND group_id IN (SELECT public.get_my_group_ids()))
  );

DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
CREATE POLICY "tasks_insert_policy" ON public.tasks
  FOR INSERT WITH CHECK (
    (group_id IS NULL AND user_id = auth.uid()) OR
    (group_id IS NOT NULL AND group_id IN (SELECT public.get_my_group_ids()))
  );

DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
CREATE POLICY "tasks_update_policy" ON public.tasks
  FOR UPDATE USING (
    (group_id IS NULL AND user_id = auth.uid()) OR
    (group_id IS NOT NULL AND group_id IN (SELECT public.get_my_group_ids()))
  );

DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;
CREATE POLICY "tasks_delete_policy" ON public.tasks
  FOR DELETE USING (
    (group_id IS NULL AND user_id = auth.uid()) OR
    (group_id IS NOT NULL AND group_id IN (SELECT public.get_my_group_ids()))
  );

-- RLS: subtasks
DROP POLICY IF EXISTS "subtasks_select_policy" ON public.subtasks;
CREATE POLICY "subtasks_select_policy" ON public.subtasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = subtasks.task_id)
  );

DROP POLICY IF EXISTS "subtasks_insert_policy" ON public.subtasks;
CREATE POLICY "subtasks_insert_policy" ON public.subtasks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = subtasks.task_id)
  );

DROP POLICY IF EXISTS "subtasks_update_policy" ON public.subtasks;
CREATE POLICY "subtasks_update_policy" ON public.subtasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = subtasks.task_id)
  );

DROP POLICY IF EXISTS "subtasks_delete_policy" ON public.subtasks;
CREATE POLICY "subtasks_delete_policy" ON public.subtasks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = subtasks.task_id)
  );
