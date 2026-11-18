/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
const supabaseUrl = (viteEnv?.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (viteEnv?.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('YOUR_SUPABASE');

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
