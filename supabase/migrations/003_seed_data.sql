-- =============================================================
-- VERDANT CRM - Seed / Demo Data
-- Migration: 003_seed_data.sql
--
-- Run this AFTER 001 and 002.
-- This creates default pipeline stages for new organizations.
-- The demo data section is optional — comment it out if not needed.
-- =============================================================

-- =============================================================
-- DEFAULT PIPELINE STAGES FUNCTION
-- Called when a new org is created
-- =============================================================

CREATE OR REPLACE FUNCTION create_default_pipeline_stages(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO pipeline_stages (org_id, name, description, probability, display_order, color, is_won, is_lost) VALUES
    (p_org_id, 'Prospecting',   'Initial outreach and research',              10,  1, '#94a3b8', false, false),
    (p_org_id, 'Qualification', 'Determining fit and budget',                  20,  2, '#60a5fa', false, false),
    (p_org_id, 'Proposal',      'Preparing and sending proposal',              50,  3, '#f59e0b', false, false),
    (p_org_id, 'Negotiation',   'Discussing terms and closing',                75,  4, '#f97316', false, false),
    (p_org_id, 'Closed Won',    'Deal successfully closed',                   100,  5, '#16a34a', true,  false),
    (p_org_id, 'Closed Lost',   'Deal lost to competitor or no decision',       0,  6, '#ef4444', false, true);
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- DEMO ORGANIZATION
-- Replace or delete this block for production
-- =============================================================

-- NOTE: This creates a demo org. In production, orgs are created
-- during user onboarding flow. You can safely delete this block.

DO $$
DECLARE
  demo_org_id UUID;
BEGIN
  INSERT INTO organizations (name, slug, industry, timezone, currency)
  VALUES ('Acme Corp (Demo)', 'acme-demo', 'technology', 'America/New_York', 'USD')
  RETURNING id INTO demo_org_id;

  PERFORM create_default_pipeline_stages(demo_org_id);
END;
$$;
