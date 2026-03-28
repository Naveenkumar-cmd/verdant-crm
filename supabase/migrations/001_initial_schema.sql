-- =============================================================
-- VERDANT CRM - Complete Database Schema
-- Migration: 001_initial_schema.sql
-- 
-- HOW TO RUN:
--   1. Go to https://app.supabase.com → Your Project → SQL Editor
--   2. Paste this entire file and click "Run"
--   3. Run 002_rls_policies.sql next
--   4. Run 003_seed_data.sql last (optional demo data)
-- =============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE lead_status AS ENUM (
  'new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'
);

CREATE TYPE lead_source AS ENUM (
  'website', 'referral', 'social_media', 'email_campaign', 'cold_call',
  'event', 'partner', 'advertisement', 'other'
);

CREATE TYPE deal_stage AS ENUM (
  'prospecting', 'qualification', 'proposal', 'negotiation',
  'closed_won', 'closed_lost'
);

CREATE TYPE task_status AS ENUM (
  'not_started', 'in_progress', 'completed', 'deferred', 'cancelled'
);

CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TYPE activity_type AS ENUM (
  'call', 'email', 'meeting', 'note', 'task', 'demo', 'follow_up'
);

CREATE TYPE contact_type AS ENUM (
  'customer', 'prospect', 'partner', 'vendor', 'other'
);

CREATE TYPE account_type AS ENUM (
  'prospect', 'customer', 'partner', 'competitor', 'vendor', 'other'
);

CREATE TYPE account_industry AS ENUM (
  'technology', 'finance', 'healthcare', 'education', 'retail',
  'manufacturing', 'real_estate', 'consulting', 'media', 'legal',
  'hospitality', 'nonprofit', 'government', 'other'
);

CREATE TYPE campaign_status AS ENUM (
  'draft', 'active', 'paused', 'completed', 'cancelled'
);

CREATE TYPE campaign_type AS ENUM (
  'email', 'social_media', 'event', 'webinar', 'content', 'paid_ads', 'other'
);

CREATE TYPE ticket_status AS ENUM (
  'open', 'in_progress', 'pending_customer', 'resolved', 'closed'
);

CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE product_status AS ENUM ('active', 'inactive', 'discontinued');

CREATE TYPE quote_status AS ENUM (
  'draft', 'sent', 'accepted', 'rejected', 'expired'
);

CREATE TYPE field_type AS ENUM (
  'text', 'textarea', 'number', 'decimal', 'boolean', 'date', 'datetime',
  'select', 'multiselect', 'email', 'phone', 'url', 'currency', 'percent', 'lookup'
);

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'sales_rep', 'viewer');

-- =============================================================
-- ORGANIZATIONS (Multi-tenancy support)
-- =============================================================

CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) UNIQUE NOT NULL,
  logo_url      TEXT,
  website       TEXT,
  industry      account_industry,
  timezone      VARCHAR(100) DEFAULT 'UTC',
  currency      VARCHAR(10) DEFAULT 'USD',
  date_format   VARCHAR(20) DEFAULT 'MM/DD/YYYY',
  settings      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- USER PROFILES (extends Supabase auth.users)
-- =============================================================

CREATE TABLE user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id        UUID REFERENCES organizations(id) ON DELETE SET NULL,
  first_name    VARCHAR(100),
  last_name     VARCHAR(100),
  email         VARCHAR(255) NOT NULL,
  phone         VARCHAR(50),
  avatar_url    TEXT,
  role          user_role DEFAULT 'sales_rep',
  title         VARCHAR(100),
  department    VARCHAR(100),
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  preferences   JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- CUSTOM FIELDS SCHEMA (Module Customization)
-- =============================================================

CREATE TABLE custom_field_definitions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  module_name     VARCHAR(50) NOT NULL,  -- 'leads','contacts','accounts','deals','tasks','products'
  field_name      VARCHAR(100) NOT NULL,
  field_label     VARCHAR(150) NOT NULL,
  field_type      field_type NOT NULL,
  is_required     BOOLEAN DEFAULT FALSE,
  is_visible      BOOLEAN DEFAULT TRUE,
  display_order   INTEGER DEFAULT 0,
  default_value   TEXT,
  options         JSONB,  -- for select/multiselect: [{"label":"Option","value":"option"}]
  validation      JSONB,  -- {"min":0,"max":100,"pattern":"..."}
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, module_name, field_name)
);

-- =============================================================
-- PIPELINE STAGES (Customizable deal pipeline)
-- =============================================================

CREATE TABLE pipeline_stages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  probability     INTEGER DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  display_order   INTEGER DEFAULT 0,
  color           VARCHAR(7) DEFAULT '#16a34a',
  is_won          BOOLEAN DEFAULT FALSE,
  is_lost         BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- ACCOUNTS
-- =============================================================

CREATE TABLE accounts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  type              account_type DEFAULT 'prospect',
  industry          account_industry,
  website           TEXT,
  phone             VARCHAR(50),
  email             VARCHAR(255),
  fax               VARCHAR(50),
  -- Address
  billing_street    TEXT,
  billing_city      VARCHAR(100),
  billing_state     VARCHAR(100),
  billing_zip       VARCHAR(20),
  billing_country   VARCHAR(100),
  shipping_street   TEXT,
  shipping_city     VARCHAR(100),
  shipping_state    VARCHAR(100),
  shipping_zip      VARCHAR(20),
  shipping_country  VARCHAR(100),
  -- Business info
  annual_revenue    DECIMAL(15,2),
  employees         INTEGER,
  sic_code          VARCHAR(10),
  parent_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  description       TEXT,
  rating            VARCHAR(20),  -- 'hot','warm','cold'
  -- Ownership
  owner_id          UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  -- Custom fields (stored as JSONB)
  custom_fields     JSONB DEFAULT '{}',
  tags              TEXT[] DEFAULT '{}',
  -- Metadata
  created_by        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- =============================================================
-- CONTACTS
-- =============================================================

CREATE TABLE contacts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE,
  account_id        UUID REFERENCES accounts(id) ON DELETE SET NULL,
  -- Personal info
  salutation        VARCHAR(20),
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  title             VARCHAR(100),
  department        VARCHAR(100),
  type              contact_type DEFAULT 'prospect',
  -- Contact details
  email             VARCHAR(255),
  secondary_email   VARCHAR(255),
  phone             VARCHAR(50),
  mobile            VARCHAR(50),
  fax               VARCHAR(50),
  linkedin_url      TEXT,
  twitter_handle    VARCHAR(100),
  website           TEXT,
  -- Address
  street            TEXT,
  city              VARCHAR(100),
  state             VARCHAR(100),
  zip               VARCHAR(20),
  country           VARCHAR(100),
  -- Personal
  date_of_birth     DATE,
  do_not_call       BOOLEAN DEFAULT FALSE,
  do_not_email      BOOLEAN DEFAULT FALSE,
  -- Business context
  lead_source       lead_source,
  description       TEXT,
  -- Ownership
  owner_id          UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  -- Custom fields
  custom_fields     JSONB DEFAULT '{}',
  tags              TEXT[] DEFAULT '{}',
  -- Metadata
  created_by        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- =============================================================
-- LEADS
-- =============================================================

CREATE TABLE leads (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID REFERENCES organizations(id) ON DELETE CASCADE,
  -- Personal info
  salutation          VARCHAR(20),
  first_name          VARCHAR(100) NOT NULL,
  last_name           VARCHAR(100) NOT NULL,
  title               VARCHAR(100),
  -- Company info
  company             VARCHAR(255),
  industry            account_industry,
  -- Contact details
  email               VARCHAR(255),
  phone               VARCHAR(50),
  mobile              VARCHAR(50),
  website             TEXT,
  linkedin_url        TEXT,
  -- Address
  street              TEXT,
  city                VARCHAR(100),
  state               VARCHAR(100),
  zip                 VARCHAR(20),
  country             VARCHAR(100),
  -- Lead qualification
  status              lead_status DEFAULT 'new',
  source              lead_source DEFAULT 'other',
  rating              VARCHAR(20),  -- 'hot','warm','cold'
  annual_revenue      DECIMAL(15,2),
  no_of_employees     INTEGER,
  -- Conversion tracking
  is_converted        BOOLEAN DEFAULT FALSE,
  converted_at        TIMESTAMPTZ,
  converted_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  converted_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  converted_deal_id   UUID,  -- references deals after deals table created
  -- Qualification
  description         TEXT,
  do_not_call         BOOLEAN DEFAULT FALSE,
  do_not_email        BOOLEAN DEFAULT FALSE,
  -- Campaign tracking
  campaign_id         UUID,
  -- Ownership
  owner_id            UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  -- Custom fields
  custom_fields       JSONB DEFAULT '{}',
  tags                TEXT[] DEFAULT '{}',
  -- Metadata
  created_by          UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

-- =============================================================
-- DEALS (Opportunities)
-- =============================================================

CREATE TABLE deals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  -- Related records
  account_id        UUID REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  -- Pipeline
  stage_id          UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  stage_name        VARCHAR(100),  -- cached for performance
  -- Financial
  amount            DECIMAL(15,2) DEFAULT 0,
  currency          VARCHAR(10) DEFAULT 'USD',
  probability       INTEGER DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  expected_revenue  DECIMAL(15,2) GENERATED ALWAYS AS (amount * probability / 100.0) STORED,
  -- Dates
  close_date        DATE NOT NULL,
  actual_close_date DATE,
  -- Classification
  deal_type         VARCHAR(50),   -- 'new_business','existing_business','renewal'
  lead_source       lead_source,
  campaign_id       UUID,
  -- Status
  is_won            BOOLEAN DEFAULT FALSE,
  is_lost           BOOLEAN DEFAULT FALSE,
  lost_reason       TEXT,
  next_step         TEXT,
  description       TEXT,
  -- Ownership
  owner_id          UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  -- Custom fields
  custom_fields     JSONB DEFAULT '{}',
  tags              TEXT[] DEFAULT '{}',
  -- Metadata
  created_by        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- Add FK for leads.converted_deal_id now that deals table exists
ALTER TABLE leads ADD CONSTRAINT fk_leads_converted_deal
  FOREIGN KEY (converted_deal_id) REFERENCES deals(id) ON DELETE SET NULL;

-- =============================================================
-- TASKS
-- =============================================================

CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  -- Status & Priority
  status          task_status DEFAULT 'not_started',
  priority        task_priority DEFAULT 'medium',
  -- Dates
  due_date        DATE,
  due_time        TIME,
  reminder_at     TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  -- Related records (polymorphic)
  related_to_type VARCHAR(50),  -- 'lead','contact','account','deal'
  related_to_id   UUID,
  -- Ownership
  owner_id        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  assigned_to_id  UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  -- Custom fields
  custom_fields   JSONB DEFAULT '{}',
  tags            TEXT[] DEFAULT '{}',
  -- Metadata
  created_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- ACTIVITIES (Calls, Emails, Meetings, Notes)
-- =============================================================

CREATE TABLE activities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type            activity_type NOT NULL,
  subject         VARCHAR(255) NOT NULL,
  description     TEXT,
  outcome         TEXT,
  -- Duration / Scheduling
  activity_date   TIMESTAMPTZ DEFAULT NOW(),
  duration_mins   INTEGER,
  -- Related records
  related_to_type VARCHAR(50),
  related_to_id   UUID,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id         UUID REFERENCES deals(id) ON DELETE SET NULL,
  account_id      UUID REFERENCES accounts(id) ON DELETE SET NULL,
  -- Email specific
  email_to        TEXT,
  email_from      TEXT,
  email_cc        TEXT,
  -- Call specific
  call_direction  VARCHAR(20),  -- 'inbound','outbound'
  call_result     VARCHAR(50),
  -- Meeting specific
  location        TEXT,
  meeting_url     TEXT,
  -- Ownership
  owner_id        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- PRODUCTS / CATALOG
-- =============================================================

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  sku             VARCHAR(100),
  description     TEXT,
  category        VARCHAR(100),
  unit_price      DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency        VARCHAR(10) DEFAULT 'USD',
  tax_rate        DECIMAL(5,2) DEFAULT 0,
  unit_of_measure VARCHAR(50) DEFAULT 'unit',
  status          product_status DEFAULT 'active',
  is_taxable      BOOLEAN DEFAULT TRUE,
  -- Custom fields
  custom_fields   JSONB DEFAULT '{}',
  created_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- QUOTES
-- =============================================================

CREATE TABLE quotes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  quote_number    VARCHAR(50) UNIQUE,
  title           VARCHAR(255) NOT NULL,
  status          quote_status DEFAULT 'draft',
  -- Related
  deal_id         UUID REFERENCES deals(id) ON DELETE SET NULL,
  account_id      UUID REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  -- Dates
  quote_date      DATE DEFAULT CURRENT_DATE,
  valid_until     DATE,
  -- Financials
  subtotal        DECIMAL(15,2) DEFAULT 0,
  discount_pct    DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount      DECIMAL(15,2) DEFAULT 0,
  shipping        DECIMAL(15,2) DEFAULT 0,
  grand_total     DECIMAL(15,2) DEFAULT 0,
  currency        VARCHAR(10) DEFAULT 'USD',
  -- Content
  terms           TEXT,
  notes           TEXT,
  -- Ownership
  owner_id        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quote_line_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id        UUID REFERENCES quotes(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  quantity        DECIMAL(10,2) DEFAULT 1,
  unit_price      DECIMAL(15,2) NOT NULL,
  discount_pct    DECIMAL(5,2) DEFAULT 0,
  tax_rate        DECIMAL(5,2) DEFAULT 0,
  total           DECIMAL(15,2) NOT NULL,
  sort_order      INTEGER DEFAULT 0
);

-- =============================================================
-- CAMPAIGNS
-- =============================================================

CREATE TABLE campaigns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  type            campaign_type DEFAULT 'email',
  status          campaign_status DEFAULT 'draft',
  description     TEXT,
  -- Dates
  start_date      DATE,
  end_date        DATE,
  -- Budget & ROI
  budget          DECIMAL(15,2),
  actual_cost     DECIMAL(15,2),
  expected_revenue DECIMAL(15,2),
  -- Metrics
  sent_count      INTEGER DEFAULT 0,
  open_count      INTEGER DEFAULT 0,
  click_count     INTEGER DEFAULT 0,
  leads_generated INTEGER DEFAULT 0,
  -- Ownership
  owner_id        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- SUPPORT TICKETS
-- =============================================================

CREATE TABLE tickets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_number   VARCHAR(50),
  subject         VARCHAR(255) NOT NULL,
  description     TEXT,
  status          ticket_status DEFAULT 'open',
  priority        ticket_priority DEFAULT 'medium',
  category        VARCHAR(100),
  -- Related
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  account_id      UUID REFERENCES accounts(id) ON DELETE SET NULL,
  deal_id         UUID REFERENCES deals(id) ON DELETE SET NULL,
  -- Dates
  due_date        DATE,
  resolved_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  -- Ownership
  owner_id        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  assigned_to_id  UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  -- Custom fields
  custom_fields   JSONB DEFAULT '{}',
  created_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- NOTES
-- =============================================================

CREATE TABLE notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title           VARCHAR(255),
  content         TEXT NOT NULL,
  -- Polymorphic relation
  related_to_type VARCHAR(50),
  related_to_id   UUID,
  -- Ownership
  created_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- DOCUMENTS / ATTACHMENTS
-- =============================================================

CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  file_url        TEXT NOT NULL,
  file_size       INTEGER,
  mime_type       VARCHAR(100),
  -- Polymorphic relation
  related_to_type VARCHAR(50),
  related_to_id   UUID,
  -- Ownership
  uploaded_by     UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- INDEXES
-- =============================================================

-- Accounts
CREATE INDEX idx_accounts_org ON accounts(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_owner ON accounts(owner_id);
CREATE INDEX idx_accounts_name ON accounts(org_id, name);

-- Contacts
CREATE INDEX idx_contacts_org ON contacts(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_account ON contacts(account_id);
CREATE INDEX idx_contacts_owner ON contacts(owner_id);
CREATE INDEX idx_contacts_email ON contacts(org_id, email);

-- Leads
CREATE INDEX idx_leads_org ON leads(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_status ON leads(org_id, status);
CREATE INDEX idx_leads_owner ON leads(owner_id);
CREATE INDEX idx_leads_email ON leads(org_id, email);

-- Deals
CREATE INDEX idx_deals_org ON deals(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deals_stage ON deals(stage_id);
CREATE INDEX idx_deals_account ON deals(account_id);
CREATE INDEX idx_deals_owner ON deals(owner_id);
CREATE INDEX idx_deals_close_date ON deals(close_date);

-- Tasks
CREATE INDEX idx_tasks_org ON tasks(org_id);
CREATE INDEX idx_tasks_owner ON tasks(owner_id);
CREATE INDEX idx_tasks_due ON tasks(due_date);
CREATE INDEX idx_tasks_related ON tasks(related_to_type, related_to_id);

-- Activities
CREATE INDEX idx_activities_org ON activities(org_id);
CREATE INDEX idx_activities_related ON activities(related_to_type, related_to_id);
CREATE INDEX idx_activities_date ON activities(activity_date);

-- =============================================================
-- UPDATED_AT TRIGGERS
-- =============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_user_profiles_updated BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_deals_updated BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_activities_updated BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- =============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-generate ticket numbers
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number = 'TKT-' || LPAD(nextval('ticket_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE ticket_seq START 1000;
CREATE TRIGGER trg_ticket_number BEFORE INSERT ON tickets FOR EACH ROW EXECUTE FUNCTION set_ticket_number();

-- Auto-generate quote numbers
CREATE OR REPLACE FUNCTION set_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number = 'QTE-' || LPAD(nextval('quote_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE quote_seq START 1000;
CREATE TRIGGER trg_quote_number BEFORE INSERT ON quotes FOR EACH ROW EXECUTE FUNCTION set_quote_number();
