-- =============================================================
-- VERDANT CRM - Organization Invites
-- Migration: 004_invites.sql
--
-- Run this AFTER 003_seed_data.sql
-- Adds the invite system so multiple companies can self-onboard
-- =============================================================

CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

CREATE TABLE org_invites (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email         VARCHAR(255) NOT NULL,
  role          user_role NOT NULL DEFAULT 'sales_rep',
  token         VARCHAR(64) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status        invite_status NOT NULL DEFAULT 'pending',
  invited_by    UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  accepted_by   UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invites_token  ON org_invites(token)  WHERE status = 'pending';
CREATE INDEX idx_invites_org    ON org_invites(org_id);
CREATE INDEX idx_invites_email  ON org_invites(email);

CREATE TRIGGER trg_invites_updated
  BEFORE UPDATE ON org_invites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE org_invites ENABLE ROW LEVEL SECURITY;

-- Org members can see their org's invites
CREATE POLICY "Org members can view invites"
  ON org_invites FOR SELECT
  USING (org_id = public.user_org_id());

-- Admins and managers can create invites
CREATE POLICY "Managers can create invites"
  ON org_invites FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND public.is_manager_or_above());

-- Admins and managers can update/cancel invites
CREATE POLICY "Managers can update invites"
  ON org_invites FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_manager_or_above());

-- Anyone can read a pending invite by token (needed for accept flow — no auth yet)
CREATE POLICY "Anyone can look up a pending invite by token"
  ON org_invites FOR SELECT
  USING (status = 'pending' AND expires_at > NOW());
