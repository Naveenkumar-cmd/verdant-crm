-- =============================================================
-- VERDANT CRM - Notes performance index
-- Migration: 006_notes_index.sql
--
-- Run this AFTER 005_org_profile_fields.sql
-- Adds a composite index on notes so looking up notes for a
-- specific record (lead, contact, account, deal) is fast.
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_notes_related
  ON notes(org_id, related_to_type, related_to_id);

CREATE INDEX IF NOT EXISTS idx_notes_created_by
  ON notes(created_by);
