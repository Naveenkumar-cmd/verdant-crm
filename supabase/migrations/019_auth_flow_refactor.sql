-- =============================================================
-- VERDANT CRM — Auth flow refactor
-- Migration: 019_auth_flow_refactor.sql
--
-- Run this AFTER all previous migrations (001–018).
-- This migration is fully idempotent — safe to run multiple times.
--
-- WHAT THIS ADDS / CHANGES
-- ─────────────────────────
-- 1. Adds `onboarding_completed` boolean column to user_profiles.
--    Previously, the app used org_id IS NOT NULL as the onboarding gate.
--    This explicit flag decouples the two concerns:
--      • org_id = which org the user belongs to
--      • onboarding_completed = whether they've finished setup
--
-- 2. Back-fills existing users:
--    • Users with org_id → onboarding_completed = true  (they already set up)
--    • Users without org_id → onboarding_completed = false (still pending)
--
-- 3. Updates handle_new_user() trigger to include onboarding_completed = false.
--
-- 4. Updates profile_update_own RLS policy (no change needed — covers all cols).
--
-- 5. Adds a SECURITY DEFINER RPC `complete_onboarding()` that the React app
--    can call as a fallback if a direct UPDATE is blocked by RLS.
--
-- 6. Updates promote_self_to_admin() to also set onboarding_completed = true
--    when promoting (org creation path = onboarding is complete).
--
-- =============================================================


-- ── 1. Add onboarding_completed column ───────────────────────────────────

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;


-- ── 2. Back-fill existing users ──────────────────────────────────────────
-- Users who already have an org_id have completed onboarding.

UPDATE public.user_profiles
SET    onboarding_completed = TRUE
WHERE  org_id IS NOT NULL
  AND  onboarding_completed = FALSE;


-- ── 3. Update handle_new_user() trigger ─────────────────────────────────
-- Explicitly sets onboarding_completed = false for new signups.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    email,
    first_name,
    last_name,
    role,
    onboarding_completed,
    created_at
  ) VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    'sales_rep',
    FALSE,      -- onboarding not started yet
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotent

  RETURN NEW;
END;
$$;

-- Re-create trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();


-- ── 4. Add complete_onboarding() RPC ─────────────────────────────────────
-- Callable by authenticated users. Sets onboarding_completed = true for
-- the calling user. Used as a fallback if the direct UPDATE from React
-- is blocked (should not happen with current RLS, but belt-and-suspenders).

CREATE OR REPLACE FUNCTION public.complete_onboarding()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET
    onboarding_completed = TRUE,
    updated_at           = NOW()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_onboarding() TO authenticated;


-- ── 5. Update promote_self_to_admin() to also set onboarding_completed ───
-- When a user creates an org (org creation = end of onboarding),
-- we set both org_id + role AND onboarding_completed in one call.

CREATE OR REPLACE FUNCTION public.promote_self_to_admin(target_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET
    org_id               = target_org_id,
    role                 = 'admin',
    onboarding_completed = TRUE,
    updated_at           = NOW()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_self_to_admin(UUID) TO authenticated;


-- ── 6. Ensure RLS policies are correct (idempotent) ──────────────────────
-- The profile_update_own policy already allows updating any column on the
-- user's own row (no column-level restrictions), so onboarding_completed
-- updates from React are covered. Recreate cleanly to be sure.

DO $$
BEGIN
  DROP POLICY IF EXISTS "profile_select_own"  ON user_profiles;
  DROP POLICY IF EXISTS "profile_insert_own"  ON user_profiles;
  DROP POLICY IF EXISTS "profile_update_own"  ON user_profiles;
END $$;

CREATE POLICY "profile_select_own"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profile_insert_own"
  ON user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profile_update_own"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());


-- ── 7. Org-member SELECT policy (for Invites page, Users settings) ────────
-- Admins/members need to see other profiles in their org.
-- This is separate from profile_select_own and uses a join-safe approach.

DROP POLICY IF EXISTS "profile_select_org_members" ON user_profiles;

CREATE POLICY "profile_select_org_members"
  ON user_profiles FOR SELECT
  USING (
    org_id IS NOT NULL
    AND org_id = (
      SELECT org_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );


-- ── Verification ─────────────────────────────────────────────────────────
-- After running, verify with:
--
-- SELECT id, email, org_id, role, onboarding_completed, created_at
-- FROM   public.user_profiles
-- ORDER  BY created_at DESC
-- LIMIT  20;
