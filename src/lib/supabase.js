// src/lib/supabase.js
//
// Supabase client initialization.
//
// SESSION DURATION
// ────────────────
// Supabase free tier uses its default JWT expiry (1 hour access token,
// 1 week refresh token rolling window). We want 15-day persistent sessions.
//
// Strategy:
//   • persistSession: true  → session survives page reloads (localStorage)
//   • autoRefreshToken: true → Supabase silently refreshes the access token
//                              on tab focus without triggering a loading state
//   • Application-level 15-day wall clock enforcement is done in AuthContext
//     via SESSION_TS_KEY in localStorage (see AuthContext.js)
//
// TOKEN_REFRESHED event handling:
//   When the user switches tabs and comes back, Supabase fires TOKEN_REFRESHED
//   via onAuthStateChange. AuthContext handles this silently — it updates the
//   user JWT but does NOT re-fetch the profile or show a loading spinner,
//   preventing the "forever loading on tab switch" issue.
//
// For projects on Supabase Pro you can set a longer JWT expiry directly in
// the dashboard (Auth → Settings → JWT expiry). On free tier we rely on
// the refresh token staying alive and our own 15-day stamp.
//
import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ Missing Supabase credentials.\n' +
    'Copy .env.example to .env.local and fill in your Supabase URL and anon key.\n' +
    'Get them from: https://app.supabase.com → Your Project → Settings → API'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken:    true,
    persistSession:      true,   // stores refresh token in localStorage
    detectSessionInUrl:  true,   // picks up tokens from email confirmation URLs
    // flowType: 'pkce',         // uncomment if you enable PKCE in Supabase dashboard
  },
});

export default supabase;
