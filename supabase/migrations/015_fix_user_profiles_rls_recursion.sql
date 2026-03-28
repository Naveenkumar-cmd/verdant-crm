-- =============================================================
-- VERDANT CRM — Fix infinite recursion in user_profiles RLS
-- Migration: 015_fix_user_profiles_rls_recursion.sql
--
-- Run this AFTER 014_grant_permissions.sql
--
-- ROOT CAUSE
-- ──────────
-- Any RLS policy on user_profiles that runs a subquery against
-- user_profiles (directly OR via a SECURITY DEFINER function that
-- queries user_profiles) causes Postgres to re-enter RLS evaluation
-- for user_profiles, producing:
--
--   "infinite recursion detected in policy for relation user_profiles"
--
-- This happens during onboarding when:
--   UPDATE user_profiles SET org_id=..., role='admin' WHERE id=auth.uid()
--
-- Postgres evaluates the UPDATE policies, which call:
--   (SELECT org_id FROM user_profiles WHERE id = auth.uid())
-- → RLS fires again on user_profiles → recursion.
--
-- It also affects current_user_org() (introduced in 012) which
-- queries user_profiles and is used in other table policies.
--
-- FIX
-- ───
-- 1. Drop ALL existing user_profiles policies.
-- 2. Replace with policies that ONLY use id = auth.uid() — a direct
--    column comparison that never queries user_profiles again.
-- 3. For the org-scoped SELECT (needed for user dropdowns in the app),
--    use a SECURITY DEFINER view instead of a recursive subquery.
-- 4. Add a dedicated INSERT policy so the auth trigger (011) can
--    create the initial profile row for a new user.
-- =============================================================


-- ── Step 1: Drop every existing user_profiles policy ─────────────────────

DROP POLICY IF EXISTS "Users can view profiles in their org"   ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile"             ON user_profiles;
DROP POLICY IF EXISTS "Org members can read profiles in org"   ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile"     ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile"           ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile in org"   ON user_profiles;
DROP POLICY IF EXISTS "Admins can update profiles in org"      ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles in org"      ON user_profiles;
DROP POLICY IF EXISTS "profile_select_own"                     ON user_profiles;
DROP POLICY IF EXISTS "profile_select_org"                     ON user_profiles;
DROP POLICY IF EXISTS "profile_update_own"                     ON user_profiles;
DROP POLICY IF EXISTS "profile_update_admin"                   ON user_profiles;


-- ── Step 2: Create a SECURITY DEFINER helper that reads user_profiles
--           WITHOUT triggering RLS (bypasses it at the function level).
--           This is safe to call from OTHER tables' policies; we must
--           never call it from a user_profiles policy itself. ─────────────

CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Runs as the function owner (superuser context), bypassing RLS.
  -- Safe because we only expose the calling user's own org_id.
  SELECT org_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role()   TO authenticated;


-- ── Step 3: Recreate user_profiles policies — NO subqueries into
--           user_profiles allowed here. Pure auth.uid() comparisons only. ──

-- SELECT: each user can always read their own row.
-- This is the ONLY select policy on user_profiles.
-- The org-scoped listing (other users in the org) is handled via
-- the safe_user_profiles view below.
CREATE POLICY "profile_select_own"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

-- INSERT: only the auth trigger runs this (SECURITY DEFINER context).
-- We also allow authenticated users to insert their own row in case
-- the trigger fires slightly before the session is fully established.
CREATE POLICY "profile_insert_own"
  ON user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- UPDATE: a user can always update their own row.
-- No subquery, no function call — pure direct comparison. Zero recursion risk.
CREATE POLICY "profile_update_own"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());


-- ── Step 4: Create a security-definer view for org-scoped profile listing ──
-- The app needs to list all users in an org (e.g. owner dropdowns, Settings).
-- We can't do that with an RLS policy on user_profiles without recursion,
-- so we expose it through a view that runs as the definer (bypasses RLS).

DROP VIEW IF EXISTS public.safe_user_profiles;

CREATE OR REPLACE VIEW public.safe_user_profiles
WITH (security_invoker = false)   -- runs as view owner, bypassing RLS
AS
SELECT
  up.id,
  up.org_id,
  up.first_name,
  up.last_name,
  up.email,
  up.role,
  up.avatar_url,
  up.created_at,
  up.updated_at
FROM public.user_profiles up
-- Restrict to the caller's org by joining against their own row.
-- This subquery is in the VIEW, not in an RLS policy, so no recursion.
WHERE up.org_id = (
  SELECT org_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1
);

GRANT SELECT ON public.safe_user_profiles TO authenticated;


-- ── Step 5: Update all other tables that called the old helper functions ────
-- Replace calls to user_org_id() / current_user_org() / is_admin() /
-- is_manager_or_above() with calls to the new get_my_org_id() /
-- get_my_role() functions, which have the correct SECURITY DEFINER
-- + search_path setup to avoid RLS re-entry on user_profiles.
--
-- These functions are already SECURITY DEFINER so they bypass RLS when
-- they query user_profiles — no recursion possible from non-user_profiles
-- table policies.

-- Keep the old function names as aliases so existing code still works:
CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_my_org_id();
$$;

CREATE OR REPLACE FUNCTION public.current_user_org()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_my_org_id();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_my_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_above()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_my_role() IN ('admin', 'manager');
$$;

GRANT EXECUTE ON FUNCTION public.user_org_id()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_above()  TO authenticated;
