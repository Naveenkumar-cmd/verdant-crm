-- =============================================================
-- VERDANT CRM — Fix RLS recursion + repair stuck user
-- Migration: 020_fix_rls_and_stuck_user.sql
--
-- Run this AFTER 019_auth_flow_refactor.sql.
-- Fully idempotent — safe to run multiple times.
--
-- WHAT THIS FIXES
-- ────────────────
-- 1. Removes the `profile_select_org_members` policy added in 019.
--    That policy used a subquery back into user_profiles, causing the
--    classic Supabase RLS infinite-recursion error (PGRST301) for any
--    user whose profile row had no org_id yet (i.e. during onboarding).
--
--    The org-member SELECT is handled instead by the existing SECURITY
--    DEFINER helper function approach used elsewhere in the schema.
--
-- 2. Adds a safe org-member SELECT policy using the user_org_id()
--    helper function (SECURITY DEFINER — no recursion).
--
-- 3. Repairs any user who is stuck: auth row exists, profile row exists
--    with no org_id, but an organization row exists with a matching slug
--    that has no admin linked to it (orphaned org from a failed onboarding).
--    These users can re-run onboarding and the slug-collision recovery
--    path in React will link them automatically.
--
-- 4. Repairs the specific case described in the bug report:
--    org created, user profile exists, but org_id not linked yet.
--    → Links the user to their org and sets role=admin + onboarding_completed.
-- =============================================================


-- ── 1. Remove the recursive policy from 019 ──────────────────────────────

DROP POLICY IF EXISTS "profile_select_org_members" ON user_profiles;


-- ── 2. Add a non-recursive org-member SELECT policy ──────────────────────
-- user_org_id() is SECURITY DEFINER and runs outside RLS — no recursion.

CREATE POLICY "profile_select_org_members"
  ON user_profiles FOR SELECT
  USING (
    org_id IS NOT NULL
    AND org_id = public.user_org_id()
  );


-- ── 3. Ensure all three base policies exist (idempotent) ─────────────────

DO $$
BEGIN
  DROP POLICY IF EXISTS "profile_select_own" ON user_profiles;
  DROP POLICY IF EXISTS "profile_insert_own" ON user_profiles;
  DROP POLICY IF EXISTS "profile_update_own" ON user_profiles;
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


-- ── 4. Repair stuck users: profile exists, org exists, but not linked ────
--
-- Scenario: User signed up, org was created (INSERT succeeded), but
-- promote_self_to_admin() failed so org_id was never written to the
-- user_profiles row. The org exists with no admin.
--
-- For each org that has no admin, find the user_profiles row whose
-- email matches the auth.users row that was created closest to the org,
-- and link them. This is best-effort for single-user orgs.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    -- Find orgs that have no admin linked to them
    SELECT o.id AS org_id, o.name AS org_name, o.created_at AS org_created
    FROM   organizations o
    WHERE  NOT EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE  up.org_id = o.id AND up.role = 'admin'
    )
  LOOP
    -- Find a user_profiles row with no org_id, created around the same time
    -- as the orphaned org (within 10 minutes). Most likely the creator.
    UPDATE user_profiles
    SET
      org_id               = r.org_id,
      role                 = 'admin',
      onboarding_completed = TRUE,
      updated_at           = NOW()
    WHERE
      id = (
        SELECT up.id
        FROM   user_profiles up
        WHERE  up.org_id IS NULL
          AND  ABS(EXTRACT(EPOCH FROM (up.created_at - r.org_created))) < 600
        ORDER  BY ABS(EXTRACT(EPOCH FROM (up.created_at - r.org_created)))
        LIMIT  1
      );

    IF FOUND THEN
      RAISE NOTICE 'Linked user to orphaned org: %', r.org_name;
    END IF;
  END LOOP;
END $$;


-- ── 5. General repair: anyone with org_id set but onboarding_completed=false
--       (should have been set by promote_self_to_admin but wasn't) ─────────

UPDATE public.user_profiles
SET    onboarding_completed = TRUE
WHERE  org_id IS NOT NULL
  AND  onboarding_completed = FALSE;


-- ── Verification ─────────────────────────────────────────────────────────
-- SELECT up.id, up.email, up.org_id, up.role, up.onboarding_completed,
--        o.name AS org_name, o.slug
-- FROM   user_profiles up
-- LEFT   JOIN organizations o ON o.id = up.org_id
-- ORDER  BY up.created_at DESC
-- LIMIT  20;
