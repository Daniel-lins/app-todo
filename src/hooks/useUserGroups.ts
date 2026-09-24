'use client';

import { useState, useCallback } from 'react';
import { TaskGroup, GroupMember } from '../types/todo';
import { generateInviteCode, normalizeInviteCode, isValidInviteCodeFormat } from '../utils/groupInvite';
import type { SupabaseClient } from '@supabase/supabase-js';

export function useUserGroups(supabase: SupabaseClient) {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);

  const fetchCloudGroups = useCallback(async (userId: string) => {
    try {
      const { data: memberRows, error: memberErr } = await supabase
        .from('group_members')
        .select('group_id, role')
        .eq('user_id', userId);

      if (memberErr || !memberRows || memberRows.length === 0) {
        setGroups([]);
        return;
      }

      const groupIds = memberRows.map((r: { group_id: string }) => r.group_id);
      const { data: groupsData, error: groupsErr } = await supabase
        .from('groups')
        .select('*')
        .in('id', groupIds);

      if (groupsErr || !groupsData) {
        setGroups([]);
        return;
      }

      const mappedGroups: TaskGroup[] = groupsData.map((g) => {
        const memberInfo = memberRows.find((m: { group_id: string; role: 'owner' | 'member' }) => m.group_id === g.id);
        return {
          id: g.id,
          name: g.name,
          description: g.description,
          color: g.color || '#6366f1',
          inviteCode: g.invite_code,
          createdBy: g.created_by,
          createdAt: g.created_at,
          role: memberInfo?.role || 'member',
        };
      });

      setGroups(mappedGroups);
    } catch (err) {
      console.error('Error fetching cloud groups:', err);
    }
  }, [supabase]);

  const createGroup = useCallback(
    async (userId: string, name: string, description?: string, color?: string): Promise<TaskGroup> => {
      const inviteCode = generateInviteCode();
      const groupPayload = {
        name,
        description: description || null,
        color: color || '#6366f1',
        invite_code: inviteCode,
        created_by: userId,
      };

      const { data: newGroup, error: groupErr } = await supabase
        .from('groups')
        .insert(groupPayload)
        .select()
        .single();

      if (groupErr || !newGroup) {
        throw new Error(groupErr?.message || 'Falha ao criar grupo na nuvem.');
      }

      const { error: memberErr } = await supabase.from('group_members').insert({
        group_id: newGroup.id,
        user_id: userId,
        role: 'owner',
      });

      if (memberErr) {
        await supabase.from('groups').delete().eq('id', newGroup.id);
        throw new Error(`Falha ao registrar criador como membro do grupo: ${memberErr.message}`);
      }

      const created: TaskGroup = {
        id: newGroup.id,
        name: newGroup.name,
        description: newGroup.description,
        color: newGroup.color,
        inviteCode: newGroup.invite_code,
        createdBy: newGroup.created_by,
        createdAt: newGroup.created_at,
        role: 'owner',
      };

      setGroups((prev) => [...prev, created]);
      setCurrentGroupId(created.id);
      return created;
    },
    [supabase]
  );

  const joinGroupByCode = useCallback(
    async (userId: string, rawCode: string): Promise<TaskGroup> => {
      const code = normalizeInviteCode(rawCode);
      if (!isValidInviteCodeFormat(code)) {
        throw new Error('Formato de código inválido. O código deve ter 6 caracteres alfanuméricos.');
      }

      // Tenta RPC atômico primeiro
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('join_group_by_code', {
        p_invite_code: code,
      });

      if (!rpcErr && rpcRes) {
        const joined: TaskGroup = {
          id: rpcRes.id,
          name: rpcRes.name,
          description: rpcRes.description,
          color: rpcRes.color || '#6366f1',
          inviteCode: rpcRes.invite_code,
          createdBy: rpcRes.created_by,
          createdAt: rpcRes.created_at,
          role: 'member',
        };
        setGroups((prev) => {
          if (prev.some((g) => g.id === joined.id)) return prev;
          return [...prev, joined];
        });
        setCurrentGroupId(joined.id);
        return joined;
      }

      // Fallback padrão com verificação de colisão e membros existentes
      const { data: foundGroup, error: findErr } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', code)
        .single();

      if (findErr || !foundGroup) {
        throw new Error('Código de convite não encontrado ou grupo inexistente.');
      }

      const { data: existingMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', foundGroup.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingMember) {
        setCurrentGroupId(foundGroup.id);
        const existing = groups.find((g) => g.id === foundGroup.id);
        if (existing) return existing;
      }

      const { error: joinErr } = await supabase.from('group_members').insert({
        group_id: foundGroup.id,
        user_id: userId,
        role: 'member',
      });

      if (joinErr) {
        throw new Error(`Falha ao ingressar no grupo: ${joinErr.message}`);
      }

      const joinedGroup: TaskGroup = {
        id: foundGroup.id,
        name: foundGroup.name,
        description: foundGroup.description,
        color: foundGroup.color,
        inviteCode: foundGroup.invite_code,
        createdBy: foundGroup.created_by,
        createdAt: foundGroup.created_at,
        role: 'member',
      };

      setGroups((prev) => [...prev.filter((g) => g.id !== joinedGroup.id), joinedGroup]);
      setCurrentGroupId(joinedGroup.id);
      return joinedGroup;
    },
    [supabase, groups]
  );

  const leaveGroup = useCallback(
    async (userId: string, groupId: string) => {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Erro ao sair do grupo: ${error.message}`);
      }

      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      if (currentGroupId === groupId) {
        setCurrentGroupId(null);
      }
    },
    [supabase, currentGroupId]
  );

  const deleteGroup = useCallback(
    async (_userId: string, groupId: string) => {
      const { error } = await supabase.from('groups').delete().eq('id', groupId);
      if (error) {
        throw new Error(`Erro ao excluir grupo: ${error.message}`);
      }

      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      if (currentGroupId === groupId) {
        setCurrentGroupId(null);
      }
    },
    [supabase, currentGroupId]
  );

  const fetchGroupMembers = useCallback(
    async (groupId: string): Promise<GroupMember[]> => {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          id,
          group_id,
          user_id,
          role,
          joined_at,
          profiles (
            id,
            display_name,
            avatar_url
          )
        `)
        .eq('group_id', groupId);

      type MemberQueryResult = {
        id: string;
        group_id: string;
        user_id: string;
        role: 'owner' | 'member';
        joined_at: string;
        profiles?: { id: string; display_name: string; avatar_url: string } | Array<{ id: string; display_name: string; avatar_url: string }> | null;
      };

      if (error || !data) return [];

      return ((data || []) as unknown as MemberQueryResult[]).map((item) => {
        const prof = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        return {
          id: item.id,
          groupId: item.group_id,
          userId: item.user_id,
          role: item.role,
          joinedAt: item.joined_at,
          displayName: prof?.display_name || undefined,
          profile: prof
            ? {
                id: prof.id,
                email: '',
                displayName: prof.display_name,
                avatarUrl: prof.avatar_url,
              }
            : undefined,
        };
      });
    },
    [supabase]
  );

  return {
    groups,
    setGroups,
    currentGroupId,
    setCurrentGroupId,
    fetchCloudGroups,
    createGroup,
    joinGroupByCode,
    leaveGroup,
    deleteGroup,
    fetchGroupMembers,
  };
}
