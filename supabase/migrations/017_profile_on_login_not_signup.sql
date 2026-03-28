-- =============================================================
-- VERDANT CRM — Create user_profiles on login, not on signup
-- Migration: 017_profile_on_login_not_signup.sql
--
-- Run this AFTER 016_fix_first_user_admin_trigger.sql
--
-- PROBLEM
-- ───────
-- The handle_new_user() trigger fires on every auth.users INSERT,
-- including during signup with email confirmation disabled. This
-- creates the user_profiles row immediately on signup, before the
-- user has ever logged in. This caused the "Create Account" button
-- to freeze: Supabase fired SIGNED_IN on signup, AuthContext tried
-- to fetch the just-created profile, and the loading state got stuck.
--
-- FIX
-- ───
-- 1. Drop the on_auth_user_created trigger and handle_new_user()
--    function. The React app (AuthContext.ensureProfile) now creates
--    the profile row on first login instead.
-- 2. Ensure the RLS INSERT policy on user_profiles allows the
--    authenticated user to insert their own row (needed by
--    ensureProfile when the row doesn't exist yet).
-- 3. Keep promote_self_to_admin() from migration 016 — still used
--    by Onboarding to set org_id + role='admin'.
-- =============================================================

-- ── 1. Drop the signup trigger ────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ── 2. Ensure INSERT policy exists on user_profiles ──────────────────────
-- Migration 015 added profile_insert_own but earlier migrations may have
-- dropped it. Re-create idempotently.
DROP POLICY IF EXISTS "profile_insert_own" ON user_profiles;

CREATE POLICY "profile_insert_own"
  ON user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ── 3. Repair existing users who have an auth row but no profile row ──────
-- These are users who signed up before this migration and whose profile
-- row was never created (e.g. trigger failed). We can't create their
-- profile here because we don't have their metadata, but we can log them.
-- In practice, ensureProfile() in AuthContext will create the row on their
-- next login using the data from their auth session.
--
-- If you want to pre-populate known stuck users, run manually:
--   INSERT INTO public.user_profiles (id, email, role, created_at)
--   SELECT id, email, 'sales_rep', created_at
--   FROM auth.users
--   WHERE id NOT IN (SELECT id FROM public.user_profiles)
--   ON CONFLICT (id) DO NOTHING;
