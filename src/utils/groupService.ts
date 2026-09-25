import type { TaskGroup } from '../types/todo';

export interface GroupRpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export async function joinGroup(client: GroupRpcClient, code: string): Promise<TaskGroup> {
  const { data, error } = await client.rpc('join_group_by_code', { p_code: code });
  if (error) throw new Error(error.message);
  const result = data as { success?: boolean; message?: string; group?: TaskGroup } | null;
  if (!result?.success || !result.group?.id || !result.group?.name) {
    throw new Error(result?.message || 'Não foi possível entrar no grupo.');
  }
  return result.group;
}
