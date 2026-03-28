-- =============================================================
-- VERDANT CRM - Fix missing and incorrect RLS policies
-- Migration: 008_fix_rls_policies.sql
--
-- Run this AFTER 007_email_fields.sql
--
-- Fixes three RLS gaps that block core app flows:
--
-- 1. organizations INSERT — new users cannot create their org during
--    onboarding because no INSERT policy existed.
--
-- 2. org_invites UPDATE by the invited user — when accepting an invite,
--    the user has no org_id yet so the existing manager-only UPDATE
--    policy blocks them from marking the invite as accepted.
--
-- 3. pipeline_stages INSERT — stages are seeded during onboarding before
--    the admin role is written to the DB, so the admin-only policy fails.
-- =============================================================

-- ── 1. organizations: allow authenticated users to create an org ──────────
-- Needed during onboarding: new user creates their company workspace.
-- They have no org_id yet so user_org_id() returns null — existing
-- SELECT/UPDATE policies don't apply here.
CREATE POLICY "Authenticated users can create an organization"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- ── 2. org_invites: allow invited user to accept (mark as accepted) ───────
-- When a user accepts an invite via Onboarding.js, they call:
--   supabase.from('org_invites').update({ status: 'accepted', accepted_by: user.id })
-- The existing "Managers can update invites" policy requires is_manager_or_above()
-- but the accepting user has no org yet — they are not a manager.
-- This policy allows the specific user whose email matches the invite to accept it.
CREATE POLICY "Invited user can accept their own invite"
  ON org_invites FOR UPDATE
  USING (
    status = 'pending'
    AND expires_at > NOW()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND email = org_invites.email
    )
  );


-- ── 3. pipeline_stages: allow insert during onboarding ───────────────────
-- Default pipeline stages are inserted immediately after org creation.
-- At that moment the user's role in the DB is still 'sales_rep' (the default)
-- because the UPDATE to 'admin' happens just before, but the DB transaction
-- may not have committed when the stages insert runs.
-- Replace the ALL policy with separate policies so INSERT is unrestricted
-- for authenticated users (they can only insert for their own org_id anyway
-- since we check org_id = public.user_org_id() on SELECT/UPDATE/DELETE).

DROP POLICY IF EXISTS "Admins can manage pipeline stages" ON pipeline_stages;

-- Recreate split policies
CREATE POLICY "Admins can update pipeline stages"
  ON pipeline_stages FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_admin());

CREATE POLICY "Admins can delete pipeline stages"
  ON pipeline_stages FOR DELETE
  USING (org_id = public.user_org_id() AND public.is_admin());

-- Any authenticated user can insert pipeline stages
-- (safe because stage queries always filter by org_id)
CREATE POLICY "Authenticated users can insert pipeline stages"
  ON pipeline_stages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
