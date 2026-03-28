-- =============================================================
-- VERDANT CRM — Repair stuck users from partial onboarding
-- Script: repair_stuck_users.sql
--
-- WHO NEEDS THIS
-- ──────────────
-- Users who clicked "Create my workspace" and got the infinite
-- recursion error. Their state after that error:
--   • organizations row EXISTS (the INSERT succeeded)
--   • user_profiles.org_id IS SET (the UPDATE may have partially
--     committed on some Postgres versions, or org_id was set but
--     role was not updated)
--   • user_profiles.role = 'sales_rep' (default, not 'admin')
--
-- WHAT THIS DOES
-- ──────────────
-- For every user_profile that has an org_id but role = 'sales_rep'
-- AND whose org has no other admin, promote them to 'admin'.
-- This is safe: if they created the org, they should be admin.
--
-- Run this ONCE in the Supabase SQL Editor after applying
-- migration 015_fix_user_profiles_rls_recursion.sql.
-- =============================================================

UPDATE public.user_profiles up
SET    role = 'admin'
WHERE  up.role = 'sales_rep'
  AND  up.org_id IS NOT NULL
  AND  NOT EXISTS (
         -- Only promote if there is no other admin in the org yet
         SELECT 1
         FROM   public.user_profiles other
         WHERE  other.org_id = up.org_id
           AND  other.role   = 'admin'
           AND  other.id    <> up.id
       );

-- Confirm the repair
SELECT id, email, org_id, role
FROM   public.user_profiles
WHERE  org_id IS NOT NULL
ORDER  BY created_at DESC
LIMIT  20;
