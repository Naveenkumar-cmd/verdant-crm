-- =============================================================
-- VERDANT CRM — Grant schema & table permissions
-- Migration: 014_grant_permissions.sql
--
-- Run this in Supabase SQL Editor AFTER all previous migrations.
--
-- WHY THIS IS NEEDED
-- ──────────────────
-- In Postgres 15+ (used by newer Supabase projects) the `public`
-- schema no longer automatically grants CREATE or USAGE to the
-- PUBLIC role. Supabase's `anon` and `authenticated` roles cannot
-- even resolve table names without an explicit USAGE grant on the
-- schema, producing the error:
--
--   "permission denied for schema public"
--
-- RLS policies are evaluated AFTER schema/table access is granted,
-- so no amount of RLS fixes resolves this error — the DB rejects
-- the query before RLS even runs.
--
-- This migration grants the minimum required permissions:
--   • USAGE on schema public       → lets roles see the schema
--   • SELECT/INSERT/UPDATE/DELETE  → table-level DML access
--   • USAGE/SELECT on sequences    → lets INSERT auto-generate IDs
--
-- RLS policies still control which ROWS each user can see/mutate.
-- These grants only open the door; RLS decides what's inside.
-- =============================================================

-- ── Schema access ─────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ── Table access ──────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organizations          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.org_invites            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pipeline_stages        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.custom_field_definitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.accounts               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contacts               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.leads                  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.deals                  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks                  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.activities             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quotes                 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quote_line_items       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.campaigns              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tickets                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notes                  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.documents              TO authenticated;

-- anon role needs SELECT on org_invites to look up invite tokens
-- (the accept-invite flow runs before the user is authenticated)
GRANT SELECT ON TABLE public.org_invites TO anon;

-- ── Sequence access (needed for INSERT on tables with serial PKs) ─
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ── Function execute access ───────────────────────────────────
GRANT EXECUTE ON FUNCTION public.user_org_id()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_above()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org()     TO authenticated;

-- ── Future tables/sequences (auto-grant for any new migrations) ─
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
