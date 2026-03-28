-- =============================================================
-- VERDANT CRM - Row Level Security Policies
-- Migration: 002_rls_policies.sql
-- 
-- Run this AFTER 001_initial_schema.sql
-- =============================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- HELPER FUNCTIONS (in public schema — auth schema is restricted)
-- =============================================================

-- Get the current user's org_id
CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if current user is admin or manager
CREATE OR REPLACE FUNCTION public.is_manager_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- =============================================================
-- ORGANIZATIONS
-- =============================================================

CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (id = public.user_org_id());

CREATE POLICY "Admins can update their organization"
  ON organizations FOR UPDATE
  USING (id = public.user_org_id() AND public.is_admin());

-- =============================================================
-- USER PROFILES
-- =============================================================

CREATE POLICY "Users can view profiles in their org"
  ON user_profiles FOR SELECT
  USING (org_id = public.user_org_id() OR id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can update any profile in org"
  ON user_profiles FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_admin());

CREATE POLICY "Admins can insert profiles in org"
  ON user_profiles FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND public.is_admin());

-- =============================================================
-- CUSTOM FIELD DEFINITIONS
-- =============================================================

CREATE POLICY "Org members can view custom fields"
  ON custom_field_definitions FOR SELECT
  USING (org_id = public.user_org_id());

CREATE POLICY "Admins can manage custom fields"
  ON custom_field_definitions FOR ALL
  USING (org_id = public.user_org_id() AND public.is_admin());

-- =============================================================
-- PIPELINE STAGES
-- =============================================================

CREATE POLICY "Org members can view pipeline stages"
  ON pipeline_stages FOR SELECT
  USING (org_id = public.user_org_id());

CREATE POLICY "Admins can manage pipeline stages"
  ON pipeline_stages FOR ALL
  USING (org_id = public.user_org_id() AND public.is_admin());

-- =============================================================
-- ACCOUNTS
-- =============================================================

CREATE POLICY "Org members can view accounts"
  ON accounts FOR SELECT
  USING (org_id = public.user_org_id() AND deleted_at IS NULL);

CREATE POLICY "Org members can create accounts"
  ON accounts FOR INSERT
  WITH CHECK (org_id = public.user_org_id());

CREATE POLICY "Account owners and managers can update"
  ON accounts FOR UPDATE
  USING (
    org_id = public.user_org_id()
    AND (owner_id = auth.uid() OR public.is_manager_or_above())
  );

CREATE POLICY "Admins can delete accounts"
  ON accounts FOR DELETE
  USING (org_id = public.user_org_id() AND public.is_admin());

-- =============================================================
-- CONTACTS
-- =============================================================

CREATE POLICY "Org members can view contacts"
  ON contacts FOR SELECT
  USING (org_id = public.user_org_id() AND deleted_at IS NULL);

CREATE POLICY "Org members can create contacts"
  ON contacts FOR INSERT
  WITH CHECK (org_id = public.user_org_id());

CREATE POLICY "Contact owners and managers can update"
  ON contacts FOR UPDATE
  USING (
    org_id = public.user_org_id()
    AND (owner_id = auth.uid() OR public.is_manager_or_above())
  );

CREATE POLICY "Admins can delete contacts"
  ON contacts FOR DELETE
  USING (org_id = public.user_org_id() AND public.is_admin());

-- =============================================================
-- LEADS
-- =============================================================

CREATE POLICY "Org members can view leads"
  ON leads FOR SELECT
  USING (org_id = public.user_org_id() AND deleted_at IS NULL);

CREATE POLICY "Org members can create leads"
  ON leads FOR INSERT
  WITH CHECK (org_id = public.user_org_id());

CREATE POLICY "Lead owners and managers can update"
  ON leads FOR UPDATE
  USING (
    org_id = public.user_org_id()
    AND (owner_id = auth.uid() OR public.is_manager_or_above())
  );

CREATE POLICY "Admins can delete leads"
  ON leads FOR DELETE
  USING (org_id = public.user_org_id() AND public.is_admin());

-- =============================================================
-- DEALS
-- =============================================================

CREATE POLICY "Org members can view deals"
  ON deals FOR SELECT
  USING (org_id = public.user_org_id() AND deleted_at IS NULL);

CREATE POLICY "Org members can create deals"
  ON deals FOR INSERT
  WITH CHECK (org_id = public.user_org_id());

CREATE POLICY "Deal owners and managers can update"
  ON deals FOR UPDATE
  USING (
    org_id = public.user_org_id()
    AND (owner_id = auth.uid() OR public.is_manager_or_above())
  );

CREATE POLICY "Admins can delete deals"
  ON deals FOR DELETE
  USING (org_id = public.user_org_id() AND public.is_admin());

-- =============================================================
-- TASKS
-- =============================================================

CREATE POLICY "Org members can view tasks"
  ON tasks FOR SELECT
  USING (org_id = public.user_org_id());

CREATE POLICY "Org members can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (org_id = public.user_org_id());

CREATE POLICY "Task owners can update their tasks"
  ON tasks FOR UPDATE
  USING (
    org_id = public.user_org_id()
    AND (owner_id = auth.uid() OR assigned_to_id = auth.uid() OR public.is_manager_or_above())
  );

CREATE POLICY "Task owners can delete their tasks"
  ON tasks FOR DELETE
  USING (
    org_id = public.user_org_id()
    AND (owner_id = auth.uid() OR public.is_manager_or_above())
  );

-- =============================================================
-- ACTIVITIES, NOTES, DOCUMENTS
-- =============================================================

CREATE POLICY "Org members can view activities"
  ON activities FOR SELECT
  USING (org_id = public.user_org_id());

CREATE POLICY "Org members can manage activities"
  ON activities FOR ALL
  USING (org_id = public.user_org_id());

CREATE POLICY "Org members can view notes"
  ON notes FOR SELECT
  USING (org_id = public.user_org_id());

CREATE POLICY "Org members can manage notes"
  ON notes FOR ALL
  USING (org_id = public.user_org_id());

CREATE POLICY "Org members can view documents"
  ON documents FOR SELECT
  USING (org_id = public.user_org_id());

CREATE POLICY "Org members can manage documents"
  ON documents FOR ALL
  USING (org_id = public.user_org_id());

-- =============================================================
-- PRODUCTS, QUOTES, CAMPAIGNS, TICKETS
-- =============================================================

CREATE POLICY "Org members can view products"
  ON products FOR SELECT
  USING (org_id = public.user_org_id());

CREATE POLICY "Managers can manage products"
  ON products FOR ALL
  USING (org_id = public.user_org_id() AND public.is_manager_or_above());

CREATE POLICY "Org members can view quotes"
  ON quotes FOR SELECT
  USING (org_id = public.user_org_id());

CREATE POLICY "Org members can manage quotes"
  ON quotes FOR ALL
  USING (org_id = public.user_org_id());

CREATE POLICY "Org members can view quote line items"
  ON quote_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_line_items.quote_id
      AND q.org_id = public.user_org_id()
    )
  );

CREATE POLICY "Org members can manage quote line items"
  ON quote_line_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_line_items.quote_id
      AND q.org_id = public.user_org_id()
    )
  );

CREATE POLICY "Org members can view campaigns"
  ON campaigns FOR SELECT
  USING (org_id = public.user_org_id());

CREATE POLICY "Managers can manage campaigns"
  ON campaigns FOR ALL
  USING (org_id = public.user_org_id() AND public.is_manager_or_above());

CREATE POLICY "Org members can view tickets"
  ON tickets FOR SELECT
  USING (org_id = public.user_org_id());

CREATE POLICY "Org members can manage tickets"
  ON tickets FOR ALL
  USING (org_id = public.user_org_id());
