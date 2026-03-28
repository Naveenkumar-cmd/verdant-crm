-- =============================================================
-- VERDANT CRM — 017b: Restore the signup trigger
-- Run this ONLY if you already ran the previous 017 migration
-- that dropped handle_new_user() and on_auth_user_created.
-- =============================================================
-- The previous 017 dropped the trigger so profile rows were never
-- created on signup. This restores it in idempotent form.

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

-- Ensure RLS policies are in place
DROP POLICY IF EXISTS "profile_insert_own" ON user_profiles;
CREATE POLICY "profile_insert_own"
  ON user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profile_select_own" ON user_profiles;
CREATE POLICY "profile_select_own"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profile_update_own" ON user_profiles;
CREATE POLICY "profile_update_own"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

-- Ensure promote_self_to_admin exists
CREATE OR REPLACE FUNCTION public.promote_self_to_admin(target_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles
  SET org_id = target_org_id, role = 'admin', updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_self_to_admin(UUID) TO authenticated;

-- Repair users with org but no admin role
UPDATE public.user_profiles up
SET role = 'admin'
WHERE up.org_id IS NOT NULL
  AND up.role = 'sales_rep'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_profiles other
    WHERE other.org_id = up.org_id
      AND other.role = 'admin'
      AND other.id <> up.id
  );
