-- =============================================================
-- VERDANT CRM — Final auth & RLS consolidation
-- Migration: 018_final_auth_fixes.sql
--
-- Run this AFTER all previous migrations (001–017b).
-- This migration is fully idempotent — safe to run multiple times.
--
-- WHAT THIS FIXES
-- ───────────────
-- 1. Ensures the handle_new_user trigger is active (restores 017b
--    in case 017 was run without 017b).
--
-- 2. Repairs any existing auth.users rows that have no corresponding
--    user_profiles row (users who signed up during the trigger gap).
--
-- 3. Ensures promote_self_to_admin RPC exists and is callable.
--
-- 4. Ensures profile_insert_own, profile_select_own, and
--    profile_update_own RLS policies are in place (idempotent).
--
-- 5. Repairs stuck users: has org_id but role = 'sales_rep' with no
--    other admin in the org → promote to admin.
-- =============================================================


-- ── 1. Restore/ensure the signup trigger ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, first_name, last_name, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    'sales_rep',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ── 2. Repair users with auth row but no profile row ─────────────────────
-- These are users who signed up while the trigger was disabled (017 gap).
-- We insert a minimal row; they will be sent to /onboarding on next login
-- where they can complete setup. The React app (AuthContext.fetchProfile)
-- also attempts this insert on login as a second safety net.

INSERT INTO public.user_profiles (id, email, role, created_at)
SELECT
  au.id,
  au.email,
  'sales_rep',
  au.created_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.id = au.id
)
ON CONFLICT (id) DO NOTHING;


-- ── 3. Ensure promote_self_to_admin RPC ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.promote_self_to_admin(target_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET
    org_id     = target_org_id,
    role       = 'admin',
    updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_self_to_admin(UUID) TO authenticated;


-- ── 4. Ensure user_profiles RLS policies are correct ─────────────────────
-- Drop any old conflicting policies first, then recreate cleanly.

DO $$
BEGIN
  -- SELECT
  DROP POLICY IF EXISTS "profile_select_own"              ON user_profiles;
  DROP POLICY IF EXISTS "Users can read own profile"      ON user_profiles;
  DROP POLICY IF EXISTS "Users can view profiles in their org" ON user_profiles;
  DROP POLICY IF EXISTS "Org members can read profiles in org" ON user_profiles;

  -- INSERT
  DROP POLICY IF EXISTS "profile_insert_own"              ON user_profiles;
  DROP POLICY IF EXISTS "Admins can insert profiles in org" ON user_profiles;

  -- UPDATE
  DROP POLICY IF EXISTS "profile_update_own"              ON user_profiles;
  DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
  DROP POLICY IF EXISTS "Users can update own profile"    ON user_profiles;
  DROP POLICY IF EXISTS "Admins can update any profile in org" ON user_profiles;
  DROP POLICY IF EXISTS "Admins can update profiles in org"    ON user_profiles;
  DROP POLICY IF EXISTS "profile_update_admin"            ON user_profiles;
END $$;

-- Only these three are needed — all use direct auth.uid() with no subqueries.

CREATE POLICY "profile_select_own"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profile_insert_own"
  ON user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profile_update_own"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());


-- ── 5. Repair stuck users: org_id set but role never promoted ────────────

UPDATE public.user_profiles up
SET    role = 'admin'
WHERE  up.org_id IS NOT NULL
  AND  up.role = 'sales_rep'
  AND  NOT EXISTS (
    SELECT 1 FROM public.user_profiles other
    WHERE  other.org_id = up.org_id
      AND  other.role   = 'admin'
      AND  other.id    <> up.id
  );


-- ── Verification query (review output after running) ─────────────────────
-- SELECT id, email, org_id, role, created_at
-- FROM   public.user_profiles
-- ORDER  BY created_at DESC
-- LIMIT  20;
