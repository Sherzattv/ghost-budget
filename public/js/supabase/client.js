/**
 * Ghost Budget — Supabase Client
 * Singleton client instance
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

// Create and export singleton client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to get current user
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// Helper to get current session
export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}
