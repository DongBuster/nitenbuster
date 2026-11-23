import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null | undefined;

function readEnv(key: string): string | undefined {
  const metaEnv = (import.meta as { env?: Record<string, string | undefined> })
    .env;
  const val = metaEnv?.[key];
  return typeof val === 'string' && val.trim().length > 0
    ? val.trim()
    : undefined;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    readEnv('VITE_SUPABASE_URL') && readEnv('VITE_SUPABASE_ANON_KEY'),
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const url = readEnv('VITE_SUPABASE_URL');
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY');

  if (!url || !anonKey) {
    cachedClient = null;
    return null;
  }

  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 15,
      },
    },
  });

  return cachedClient;
}
