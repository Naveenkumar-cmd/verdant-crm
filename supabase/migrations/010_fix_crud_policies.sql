-- =============================================================
-- VERDANT CRM — Complete RLS rebuild
-- Migration: 010_fix_crud_policies.sql
-- Run AFTER 009_fix_profile_select.sql
--
-- WHY THIS EXISTS
-- ───────────────
-- All policies in 002–009 call public.user_org_id() or public.is_admin()
-- which are SECURITY DEFINER functions that query user_profiles.
-- In practice these functions return NULL on Supabase free-tier due to
-- plan-level query caching. NULL = anything is always FALSE in SQL, so
-- every UPDATE and DELETE is silently blocked for every user.
--
-- FIX: Replace every function call with a direct inline subquery.
-- No functions, no caching, no NULL surprises.
--
-- ROLE MODEL (preserved from original design)
-- ────────────────────────────────────────────
--   viewer     → SELECT only
--   sales_rep  → SELECT + INSERT + UPDATE/DELETE own records (owner_id = me)
--               + UPDATE/DELETE records with no owner (owner_id IS NULL)
--   manager    → SELECT + INSERT + UPDATE/DELETE all records in org
--   admin      → Everything managers can do + Settings (pipeline, custom fields,
--                users, org profile) + invite management
--
-- HELPER MACROS (inlined into every policy, never called as functions)
--   my_org  →  (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
--   my_role →  (SELECT role   FROM user_profiles WHERE id = auth.uid() LIMIT 1)
-- =============================================================


-- ═══════════════════════════════════════════════════════════════
-- ORGANIZATIONS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can view their own organization"      ON organizations;
DROP POLICY IF EXISTS "Admins can update their organization"       ON organizations;
DROP POLICY IF EXISTS "Authenticated users can create an organization" ON organizations;
DROP POLICY IF EXISTS "org_insert" ON organizations;
DROP POLICY IF EXISTS "org_select" ON organizations;
DROP POLICY IF EXISTS "org_update" ON organizations;

-- Any org member can view their org
CREATE POLICY "org_select" ON organizations FOR SELECT
  USING (id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

-- Admin only can update org settings
CREATE POLICY "org_update" ON organizations FOR UPDATE
  USING (
    id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
  );

-- Any authenticated user can create an org (needed for onboarding)
CREATE POLICY "org_insert" ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- ═══════════════════════════════════════════════════════════════
-- USER PROFILES  (already fixed in 009 — just ensure clean state)
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can view profiles in their org"  ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile"            ON user_profiles;
DROP POLICY IF EXISTS "Org members can read profiles in org"  ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile"    ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile"          ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile in org"  ON user_profiles;
DROP POLICY IF EXISTS "Admins can update profiles in org"     ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles in org"     ON user_profiles;

-- Every user can read their own profile row (needed for login)
CREATE POLICY "profile_select_own" ON user_profiles FOR SELECT
  USING (id = auth.uid());

-- Org members can see other profiles in their org (needed for user dropdowns)
CREATE POLICY "profile_select_org" ON user_profiles FOR SELECT
  USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

-- Users can update their own profile
CREATE POLICY "profile_update_own" ON user_profiles FOR UPDATE
  USING (id = auth.uid());

-- Admins can update anyone in their org
CREATE POLICY "profile_update_admin" ON user_profiles FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
  );


-- ═══════════════════════════════════════════════════════════════
-- LEADS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Org members can view leads"           ON leads;
DROP POLICY IF EXISTS "Org members can create leads"         ON leads;
DROP POLICY IF EXISTS "Lead owners and managers can update"  ON leads;
DROP POLICY IF EXISTS "Admins can delete leads"              ON leads;
DROP POLICY IF EXISTS "Org members can update leads"         ON leads;
DROP POLICY IF EXISTS "Org members can delete leads"         ON leads;

CREATE POLICY "leads_select" ON leads FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND deleted_at IS NULL
  );

CREATE POLICY "leads_insert" ON leads FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "leads_update" ON leads FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (
      -- viewer cannot edit
      (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) <> 'viewer'
    )
    AND (
      -- sales_rep can only edit own or unassigned
      (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) IN ('manager','admin')
      OR owner_id = auth.uid()
      OR owner_id IS NULL
    )
  );

CREATE POLICY "leads_delete" ON leads FOR DELETE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (
      (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) IN ('manager','admin')
      OR owner_id = auth.uid()
      OR owner_id IS NULL
    )
  );


-- ═══════════════════════════════════════════════════════════════
-- CONTACTS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Org members can view contacts"           ON contacts;
DROP POLICY IF EXISTS "Org members can create contacts"         ON contacts;
DROP POLICY IF EXISTS "Contact owners and managers can update"  ON contacts;
DROP POLICY IF EXISTS "Admins can delete contacts"              ON contacts;
DROP POLICY IF EXISTS "Org members can update contacts"         ON contacts;
DROP POLICY IF EXISTS "Org members can delete contacts"         ON contacts;

CREATE POLICY "contacts_select" ON contacts FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND deleted_at IS NULL
  );

CREATE POLICY "contacts_insert" ON contacts FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "contacts_update" ON contacts FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) <> 'viewer'
    AND (
      (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) IN ('manager','admin')
      OR owner_id = auth.uid()
      OR owner_id IS NULL
    )
  );

CREATE POLICY "contacts_delete" ON contacts FOR DELETE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (
      (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) IN ('manager','admin')
      OR owner_id = auth.uid()
      OR owner_id IS NULL
    )
  );


-- ═══════════════════════════════════════════════════════════════
-- ACCOUNTS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Org members can view accounts"           ON accounts;
DROP POLICY IF EXISTS "Org members can create accounts"         ON accounts;
DROP POLICY IF EXISTS "Account owners and managers can update"  ON accounts;
DROP POLICY IF EXISTS "Admins can delete accounts"              ON accounts;
DROP POLICY IF EXISTS "Org members can update accounts"         ON accounts;
DROP POLICY IF EXISTS "Org members can delete accounts"         ON accounts;

CREATE POLICY "accounts_select" ON accounts FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND deleted_at IS NULL
  );

CREATE POLICY "accounts_insert" ON accounts FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "accounts_update" ON accounts FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) <> 'viewer'
    AND (
      (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) IN ('manager','admin')
      OR owner_id = auth.uid()
      OR owner_id IS NULL
    )
  );

CREATE POLICY "accounts_delete" ON accounts FOR DELETE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (
      (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) IN ('manager','admin')
      OR owner_id = auth.uid()
      OR owner_id IS NULL
    )
  );


-- ═══════════════════════════════════════════════════════════════
-- DEALS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Org members can view deals"           ON deals;
DROP POLICY IF EXISTS "Org members can create deals"         ON deals;
DROP POLICY IF EXISTS "Deal owners and managers can update"  ON deals;
DROP POLICY IF EXISTS "Admins can delete deals"              ON deals;
DROP POLICY IF EXISTS "Org members can update deals"         ON deals;
DROP POLICY IF EXISTS "Org members can delete deals"         ON deals;

CREATE POLICY "deals_select" ON deals FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND deleted_at IS NULL
  );

CREATE POLICY "deals_insert" ON deals FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "deals_update" ON deals FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) <> 'viewer'
    AND (
      (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) IN ('manager','admin')
      OR owner_id = auth.uid()
      OR owner_id IS NULL
    )
  );

CREATE POLICY "deals_delete" ON deals FOR DELETE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (
      (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) IN ('manager','admin')
      OR owner_id = auth.uid()
      OR owner_id IS NULL
    )
  );


-- ═══════════════════════════════════════════════════════════════
-- TASKS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Org members can view tasks"        ON tasks;
DROP POLICY IF EXISTS "Org members can create tasks"      ON tasks;
DROP POLICY IF EXISTS "Task owners can update their tasks" ON tasks;
DROP POLICY IF EXISTS "Task owners can delete their tasks" ON tasks;
DROP POLICY IF EXISTS "Org members can update tasks"      ON tasks;
DROP POLICY IF EXISTS "Org members can delete tasks"      ON tasks;

CREATE POLICY "tasks_select" ON tasks FOR SELECT
  USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "tasks_insert" ON tasks FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "tasks_update" ON tasks FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) <> 'viewer'
    AND (
      (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) IN ('manager','admin')
      OR owner_id = auth.uid()
      OR assigned_to_id = auth.uid()
      OR owner_id IS NULL
    )
  );

CREATE POLICY "tasks_delete" ON tasks FOR DELETE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (
      (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) IN ('manager','admin')
      OR owner_id = auth.uid()
      OR owner_id IS NULL
    )
  );


-- ═══════════════════════════════════════════════════════════════
-- ACTIVITIES  (all org members can manage their own activities)
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Org members can view activities"   ON activities;
DROP POLICY IF EXISTS "Org members can manage activities" ON activities;

CREATE POLICY "activities_select" ON activities FOR SELECT
  USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "activities_all" ON activities FOR ALL
  USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));


-- ═══════════════════════════════════════════════════════════════
-- NOTES
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Org members can view notes"   ON notes;
DROP POLICY IF EXISTS "Org members can manage notes" ON notes;

CREATE POLICY "notes_select" ON notes FOR SELECT
  USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "notes_all" ON notes FOR ALL
  USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));


-- ═══════════════════════════════════════════════════════════════
-- PRODUCTS  (manager+ can manage; all can view)
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Org members can view products" ON products;
DROP POLICY IF EXISTS "Managers can manage products"  ON products;
DROP POLICY IF EXISTS "Org members can manage products" ON products;

CREATE POLICY "products_select" ON products FOR SELECT
  USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "products_all" ON products FOR ALL
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) IN ('manager','admin')
  );


-- ═══════════════════════════════════════════════════════════════
-- QUOTES
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Org members can view quotes"   ON quotes;
DROP POLICY IF EXISTS "Org members can manage quotes" ON quotes;

CREATE POLICY "quotes_select" ON quotes FOR SELECT
  USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "quotes_all" ON quotes FOR ALL
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) <> 'viewer'
  );


-- ═══════════════════════════════════════════════════════════════
-- QUOTE LINE ITEMS  (inherit access from parent quote)
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Org members can view quote line items"   ON quote_line_items;
DROP POLICY IF EXISTS "Org members can manage quote line items" ON quote_line_items;

CREATE POLICY "qli_select" ON quote_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_line_items.quote_id
        AND q.org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    )
  );

CREATE POLICY "qli_all" ON quote_line_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_line_items.quote_id
        AND q.org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    )
    AND (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) <> 'viewer'
  );


-- ═══════════════════════════════════════════════════════════════
-- CAMPAIGNS  (manager+ can manage)
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Org members can view campaigns" ON campaigns;
DROP POLICY IF EXISTS "Managers can manage campaigns"  ON campaigns;
DROP POLICY IF EXISTS "Org members can manage campaigns" ON campaigns;

CREATE POLICY "campaigns_select" ON campaigns FOR SELECT
  USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "campaigns_all" ON campaigns FOR ALL
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) IN ('manager','admin')
  );


-- ═══════════════════════════════════════════════════════════════
-- TICKETS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Org members can view tickets"   ON tickets;
DROP POLICY IF EXISTS "Org members can manage tickets" ON tickets;

CREATE POLICY "tickets_select" ON tickets FOR SELECT
  USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "tickets_all" ON tickets FOR ALL
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) <> 'viewer'
  );


-- ═══════════════════════════════════════════════════════════════
-- PIPELINE STAGES  (admin only can manage)
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Org members can view pipeline stages"        ON pipeline_stages;
DROP POLICY IF EXISTS "Admins can manage pipeline stages"           ON pipeline_stages;
DROP POLICY IF EXISTS "Admins can update pipeline stages"           ON pipeline_stages;
DROP POLICY IF EXISTS "Admins can delete pipeline stages"           ON pipeline_stages;
DROP POLICY IF EXISTS "Authenticated users can insert pipeline stages" ON pipeline_stages;
DROP POLICY IF EXISTS "Org members can manage pipeline stages"      ON pipeline_stages;

CREATE POLICY "pipeline_stages_select" ON pipeline_stages FOR SELECT
  USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

-- Insert allowed during onboarding (before admin role is committed)
CREATE POLICY "pipeline_stages_insert" ON pipeline_stages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "pipeline_stages_update" ON pipeline_stages FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
  );

CREATE POLICY "pipeline_stages_delete" ON pipeline_stages FOR DELETE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
  );


-- ═══════════════════════════════════════════════════════════════
-- CUSTOM FIELD DEFINITIONS  (admin only can manage)
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Org members can view custom fields"   ON custom_field_definitions;
DROP POLICY IF EXISTS "Admins can manage custom fields"      ON custom_field_definitions;
DROP POLICY IF EXISTS "Org members can manage custom fields" ON custom_field_definitions;

CREATE POLICY "custom_fields_select" ON custom_field_definitions FOR SELECT
  USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "custom_fields_all" ON custom_field_definitions FOR ALL
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
  );


-- ═══════════════════════════════════════════════════════════════
-- ORG INVITES
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Org members can view invites"              ON org_invites;
DROP POLICY IF EXISTS "Managers can create invites"               ON org_invites;
DROP POLICY IF EXISTS "Managers can update invites"               ON org_invites;
DROP POLICY IF EXISTS "Anyone can look up a pending invite by token" ON org_invites;
DROP POLICY IF EXISTS "Invited user can accept their own invite"  ON org_invites;
DROP POLICY IF EXISTS "Org members can manage invites"            ON org_invites;
DROP POLICY IF EXISTS "Invited user can accept invite"            ON org_invites;

-- Org members see their org's invites
CREATE POLICY "invites_select_org" ON org_invites FOR SELECT
  USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

-- Anyone can look up a pending invite by token (for accept flow, no org yet)
CREATE POLICY "invites_select_token" ON org_invites FOR SELECT
  USING (status = 'pending' AND expires_at > NOW());

-- Manager+ can create and cancel invites
CREATE POLICY "invites_insert" ON org_invites FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) IN ('manager','admin')
  );

CREATE POLICY "invites_update_manager" ON org_invites FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) IN ('manager','admin')
  );

-- Invited user can accept their own invite (they have no org_id yet)
CREATE POLICY "invites_accept" ON org_invites FOR UPDATE
  USING (
    status = 'pending'
    AND expires_at > NOW()
    AND email = (SELECT email FROM user_profiles WHERE id = auth.uid() LIMIT 1)
  );


-- ═══════════════════════════════════════════════════════════════
-- DOCUMENTS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Org members can view documents"   ON documents;
DROP POLICY IF EXISTS "Org members can manage documents" ON documents;

CREATE POLICY "documents_select" ON documents FOR SELECT
  USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));

CREATE POLICY "documents_all" ON documents FOR ALL
  USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid() LIMIT 1));
