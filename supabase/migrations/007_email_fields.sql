-- =============================================================
-- VERDANT CRM - Email body fields on activities
-- Migration: 007_email_fields.sql
--
-- Run this AFTER 006_notes_index.sql
-- Adds email body and subject columns to the activities table
-- so outbound emails sent from the CRM are stored with full content.
-- =============================================================

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS email_subject  TEXT,
  ADD COLUMN IF NOT EXISTS email_body_text TEXT,
  ADD COLUMN IF NOT EXISTS email_body_html TEXT,
  ADD COLUMN IF NOT EXISTS email_status    VARCHAR(30) DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS email_message_id TEXT;

-- Index for quick lookup of email activities per record
CREATE INDEX IF NOT EXISTS idx_activities_email
  ON activities(org_id, type, related_to_type, related_to_id)
  WHERE type = 'email';
