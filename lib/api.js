// lib/api.js — Single source of truth for browser-side auth + fetch
// Fixes:
//   Item 6: authFetch was duplicated between PulseApp.jsx and hooks.js
//   Item 7: createBrowserClient() was called on every request; now a singleton

import { createBrowserClient } from './supabase';

// ── Singleton Supabase browser client ──────────────────────────────────────
// The Supabase SDK is designed to be a singleton. Calling the constructor on
// every fetch creates unnecessary overhead and can cause race conditions with
// auth state management.
let _supabaseClient = null;

export function getSupabase() {
  if (!_supabaseClient) {
    _supabaseClient = createBrowserClient();
  }
  return _supabaseClient;
}

// ── Unified authFetch ──────────────────────────────────────────────────────
// Drop-in replacement for fetch() that automatically attaches the Supabase
// session token as Authorization: Bearer <token>.
// All API routes call getUserId(req) which requires this header.
// Import this wherever you need an authenticated fetch — do NOT redefine it.
export async function authFetch(url, options = {}) {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
