import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .trim()
    .replace(/^[\uFEFF\xA0]+|[\uFEFF\xA0]+$/g, '');
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
    .trim()
    .replace(/^[\uFEFF\xA0]+|[\uFEFF\xA0]+$/g, '');

  return createBrowserClient(url, anonKey);
}
