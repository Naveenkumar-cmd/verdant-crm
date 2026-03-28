-- =============================================================
-- VERDANT CRM - Extend organisations table with profile fields
-- Migration: 005_org_profile_fields.sql
--
-- Run this AFTER 004_invites.sql
-- Adds phone, email and billing address columns to organizations
-- so the Settings → Organisation page can store them.
-- =============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS phone            VARCHAR(50),
  ADD COLUMN IF NOT EXISTS email            VARCHAR(255),
  ADD COLUMN IF NOT EXISTS billing_street   TEXT,
  ADD COLUMN IF NOT EXISTS billing_city     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS billing_state    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS billing_zip      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS billing_country  VARCHAR(100);
