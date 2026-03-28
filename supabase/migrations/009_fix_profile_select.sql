-- =============================================================
-- VERDANT CRM - Fix user_profiles SELECT + all RLS recursion
-- Migration: 009_fix_profile_select.sql
--
-- Run this AFTER 008_fix_rls_policies.sql
--
-- ROOT CAUSE OF BUFFERING AFTER LOGIN:
-- The user_org_id() function queries user_profiles, and user_profiles 
-- has RLS enabled. When RLS evaluates a policy on user_profiles that
-- calls user_org_id(), PostgreSQL evaluates RLS on user_profiles AGAIN
-- to execute the function — causing recursive RLS evaluation that hangs
-- or times out.
--
-- FIX: Replace ALL policies that call user_org_id() on user_profiles
-- with direct auth.uid() checks. For the SELECT policy specifically,
-- ONLY use id = auth.uid() so a user can always read their own row
-- without any recursive function calls.
-- =============================================================

-- ── Step 1: Fix user_profiles SELECT — remove ALL recursion ──────────────

DROP POLICY IF EXISTS "Users can view profiles in their org" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Org members can read profiles in org" ON user_profiles;

-- The ONLY policy needed for login to work: a user can read their own row.
-- No org check, no function call, no recursion. Pure direct id match.
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());


-- ── Step 2: Fix user_profiles UPDATE — remove recursive calls ────────────

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile in org" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles in org" ON user_profiles;

-- User can always update their own row
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

-- Admin can update any profile — but check org_id directly, not via function
CREATE POLICY "Admins can update profiles in org"
  ON user_profiles FOR UPDATE
  USING (
    org_id IS NOT NULL
    AND org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ── Step 3: Fix user_org_id() function — make it truly bypass RLS ────────
-- The function already has SECURITY DEFINER but we also need to set
-- search_path so it reads from public schema correctly and bypasses
-- any session-level RLS settings.

CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

-- Recreate is_admin and is_manager_or_above with same fix
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_manager_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;
