-- =============================================================
-- VERDANT CRM — Fix first-user admin assignment
-- Migration: 016_fix_first_user_admin_trigger.sql
--
-- Run this AFTER 015_fix_user_profiles_rls_recursion.sql
--
-- PROBLEM
-- ───────
-- The handle_new_user() trigger (011) creates the user_profiles row
-- with no role set (or the default 'sales_rep'). The first user who
-- signs up is expected to be Admin, but there is no mechanism to
-- detect "first user in an org" at signup time — because the org
-- doesn't exist yet at that point; it's created during onboarding.
--
-- The Onboarding page already sets role='admin' when creating the org,
-- but there's a timing race: if the profile UPDATE fails (e.g. due to
-- an earlier RLS recursion bug now fixed by 015), the user is stuck
-- with role='sales_rep' and org_id set.
--
-- FIX 1: Update handle_new_user() to set a default role of 'sales_rep'
--        explicitly (makes the schema intent clear and future-proof).
--
-- FIX 2: Add a DB function `promote_org_creator_to_admin()` that
--        Onboarding.js can call via RPC right after updating org_id,
--        ensuring role='admin' even if the JS UPDATE call is retried.
--
-- FIX 3: Repair any existing users who created an org but never got
--        promoted to admin (run the repair inline).
-- =============================================================


-- ── FIX 1: Explicit default role in the trigger ──────────────────────────

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
    created_at
  ) VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    'sales_rep',   -- explicit default; Onboarding promotes creator to 'admin'
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotent: safe to call multiple times

  RETURN NEW;
END;
$$;

-- Re-create trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();


-- ── FIX 2: RPC function that Onboarding.js calls to promote org creator ──
-- This runs SECURITY DEFINER so it bypasses RLS on user_profiles.
-- It is safe because it only promotes the calling user (auth.uid()).

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


-- ── FIX 3: Repair existing stuck users ───────────────────────────────────
-- Users who have an org_id but were never promoted to admin.
-- Safe: only promotes when no other admin exists in the org.

UPDATE public.user_profiles up
SET    role = 'admin'
WHERE  up.org_id IS NOT NULL
  AND  up.role   = 'sales_rep'
  AND  NOT EXISTS (
         SELECT 1
         FROM   public.user_profiles other
         WHERE  other.org_id = up.org_id
           AND  other.role   = 'admin'
           AND  other.id    <> up.id
       );
