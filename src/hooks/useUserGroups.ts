'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { TaskGroup, GroupMember } from '../types/todo';
import { generateInviteCode, normalizeInviteCode, isValidInviteCodeFormat } from '../utils/groupInvite';
import { joinGroup } from '../utils/groupService';
import type { SupabaseClient } from '@supabase/supabase-js';

export function useUserGroups(supabase: SupabaseClient, userId: string | null) {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);

  const [accountId, setAccountId] = useState(userId);
  if (accountId !== userId) {
    setAccountId(userId);
    setGroups([]);
    setCurrentGroupId(null);
  }
  const accountRef = useRef(userId);
  const requestRef = useRef(0);
  useEffect(() => {
    accountRef.current = userId;
    requestRef.current++;
    const requests = requestRef;
    return () => { requests.current++; accountRef.current = null; };
  }, [userId]);

  const fetchCloudGroups = useCallback(async (userId: string) => {
    const request = ++requestRef.current;
    try {
      const { data: memberRows, error: memberErr } = await supabase
        .from('group_members')
        .select('group_id, role')
        .eq('user_id', userId);

      if (request !== requestRef.current || accountRef.current !== userId) return;
      if (memberErr) throw new Error(memberErr.message);
      if (!memberRows || memberRows.length === 0) {
        setGroups([]);
        return;
      }

      const groupIds = memberRows.map((r: { group_id: string }) => r.group_id);
      const { data: groupsData, error: groupsErr } = await supabase
        .from('groups')
        .select('*')
        .in('id', groupIds);

      if (request !== requestRef.current || accountRef.current !== userId) return;
      if (groupsErr) throw new Error(groupsErr.message);
      if (!groupsData) {
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

      if (accountRef.current !== userId) return created;
      setGroups((prev) => [...prev.filter(g => g.id !== created.id), created]);
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

      const joined = await joinGroup(supabase, code);
      if (accountRef.current === userId) {
        setGroups(prev => [...prev.filter(g => g.id !== joined.id), joined]);
        setCurrentGroupId(joined.id);
      }
      return joined;
    }, [supabase]
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

      if (accountRef.current !== userId) return;
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      if (currentGroupId === groupId) {
        setCurrentGroupId(null);
      }
    },
    [supabase, currentGroupId]
  );

  const deleteGroup = useCallback(
    async (userId: string, groupId: string) => {
      const { data, error } = await supabase.from('groups').delete().eq('id', groupId).eq('created_by', userId).select('id');
      if (!error && !data?.length) throw new Error('Grupo não encontrado ou sem permissão para excluir.');
      if (error) {
        throw new Error(`Erro ao excluir grupo: ${error.message}`);
      }

      if (accountRef.current !== userId) return;
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      if (currentGroupId === groupId) {
        setCurrentGroupId(null);
      }
    },
    [supabase, currentGroupId]
  );

  const fetchGroupMembers = useCallback(
    async (groupId: string): Promise<GroupMember[]> => {
      const { data, error } = await supabase.rpc('list_group_members', { p_group_id: groupId });
      if (error) throw new Error(error.message);
      return (data || []).map((item: { id: string; group_id: string; user_id: string; role: 'owner' | 'member'; joined_at: string; display_name?: string; avatar_url?: string }) => ({
        id: item.id, groupId: item.group_id, userId: item.user_id, role: item.role,
        joinedAt: item.joined_at, displayName: item.display_name,
        profile: item.display_name ? { id: item.user_id, email: '', displayName: item.display_name, avatarUrl: item.avatar_url || 'rocket' } : undefined,
      }));
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
