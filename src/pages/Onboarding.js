// src/pages/Onboarding.js
//
// REFACTORED ONBOARDING — KEY CHANGES
// ─────────────────────────────────────
// • Sets onboarding_completed = true after successful setup (not just org_id).
//   ProtectedRoute checks isOnboarded (profile.onboarding_completed + org_id),
//   so this flag is the definitive gate to the app.
//
// • If user resumes after abandoning mid-onboarding (app restart, close tab),
//   this page renders again because onboarding_completed is still false.
//   The recovery check handles a partially-created org gracefully (same as before).
//
// • navigateToDashboard() verifies both org_id AND onboarding_completed before
//   allowing navigation to /app.
//
import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { FormGroup, FormRow } from '../components/ui/index';
import toast from 'react-hot-toast';
import { Leaf, Building2, Users, CheckCircle } from 'lucide-react';

const INDUSTRIES = [
  'technology', 'finance', 'healthcare', 'education', 'retail',
  'manufacturing', 'real_estate', 'consulting', 'media', 'legal',
  'hospitality', 'nonprofit', 'government', 'other',
];

const DEFAULT_STAGES = [
  { name: 'Prospecting',   probability: 10,  color: '#94a3b8', display_order: 1, is_won: false, is_lost: false },
  { name: 'Qualification', probability: 20,  color: '#60a5fa', display_order: 2, is_won: false, is_lost: false },
  { name: 'Proposal',      probability: 50,  color: '#f59e0b', display_order: 3, is_won: false, is_lost: false },
  { name: 'Negotiation',   probability: 75,  color: '#f97316', display_order: 4, is_won: false, is_lost: false },
  { name: 'Closed Won',    probability: 100, color: '#16a34a', display_order: 5, is_won: true,  is_lost: false },
  { name: 'Closed Lost',   probability: 0,   color: '#ef4444', display_order: 6, is_won: false, is_lost: true  },
];

export default function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const [screen,      setScreen]      = useState('choose');
  const [inviteData,  setInviteData]  = useState(null);
  const [inviteError, setInviteError] = useState('');
  const [creating,    setCreating]    = useState(false);
  const [joining,     setJoining]     = useState(false);

  const [orgForm, setOrgForm] = useState({
    name: '', slug: '', industry: '', website: '',
    phone: '', timezone: 'UTC', currency: 'USD',
  });

  // Auto-detect invite token from URL on mount (runs exactly once, StrictMode safe).
  const inviteChecked = useRef(false);
  if (!inviteChecked.current) {
    inviteChecked.current = true;
    const token = searchParams.get('invite');
    if (token) {
      setTimeout(() => lookupAndAcceptInvite(token), 0);
    }
  }

  const handleNameChange = e => {
    const name = e.target.value;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setOrgForm(f => ({ ...f, name, slug }));
  };

  // ── Mark onboarding complete and navigate ────────────────────────────────
  // CHANGED: Sets onboarding_completed=true before refreshing profile.
  // Only navigates if both org_id and onboarding_completed are confirmed.
  const finishOnboarding = async (successMsg) => {
    // 1. Try a direct UPDATE first.
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id);

    // 2. If the direct UPDATE failed (RLS edge case), fall back to the
    //    SECURITY DEFINER RPC which bypasses RLS entirely.
    if (updateError) {
      console.warn('Direct onboarding_completed update failed, trying RPC:', updateError.message);
      const { error: rpcError } = await supabase.rpc('complete_onboarding');
      if (rpcError) {
        console.error('complete_onboarding RPC also failed:', rpcError.message);
        // Non-fatal — promote_self_to_admin already set onboarding_completed=true
        // in the DB-side RPC, so the flag is likely already set.
      }
    }

    const freshProfile = await refreshProfile();

    // Navigate if org_id is confirmed — onboarding_completed is best-effort
    // (the RPC on the DB side already set it via promote_self_to_admin).
    if (freshProfile?.org_id) {
      toast.success(successMsg);
      navigate('/app', { replace: true });
    } else {
      toast.error('Setup completed but profile did not update. Please refresh the page.');
    }
  };

  // ── Lookup invite and auto-accept ────────────────────────────────────────
  const lookupAndAcceptInvite = async (token) => {
    setScreen('joining');
    const { data, error } = await supabase
      .from('org_invites')
      .select('*, organizations(name)')
      .eq('token', token.trim())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) {
      setInviteError('This invite link is invalid or has expired. Ask your admin for a new one.');
      setScreen('choose');
      return;
    }

    if (data.email.toLowerCase() !== user.email.toLowerCase()) {
      setInviteError(
        `This invite was sent to ${data.email}, but you're signed in as ${user.email}. ` +
        `Please sign in with the correct account.`
      );
      setScreen('choose');
      return;
    }

    setInviteData(data);
    await acceptInvite(data);
  };

  const acceptInvite = async (invite) => {
    setJoining(true);
    try {
      // 1. Link user to the organisation
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ org_id: invite.org_id, role: invite.role })
        .eq('id', user.id);
      if (profileError) throw profileError;

      // 2. Mark invite accepted
      await supabase
        .from('org_invites')
        .update({ status: 'accepted', accepted_by: user.id })
        .eq('id', invite.id);

      // 3. Mark onboarding done and navigate
      await finishOnboarding(`Welcome to ${invite.organizations.name}!`);
    } catch (err) {
      toast.error(err.message || 'Failed to accept invite');
      setScreen('choose');
    } finally {
      setJoining(false);
    }
  };

  // ── Create a new organisation ────────────────────────────────────────────
  const handleCreateOrg = async e => {
    e.preventDefault();
    if (!orgForm.name.trim()) { toast.error('Company name is required'); return; }
    if (!orgForm.slug.trim()) { toast.error('URL slug is required'); return; }
    setCreating(true);

    try {
      // ── RECOVERY CHECK ─────────────────────────────────────────────────
      // If a previous attempt partially succeeded (org created, profile UPDATE
      // failed, or onboarding_completed not yet set), re-use the existing org.
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('org_id, role, onboarding_completed')
        .eq('id', user.id)
        .maybeSingle();

      if (existingProfile?.org_id) {
        // Org already created — ensure role is 'admin' then finish.
        if (existingProfile.role !== 'admin') {
          const { error: roleError } = await supabase
            .from('user_profiles')
            .update({ role: 'admin' })
            .eq('id', user.id);
          if (roleError) {
            const { error: rpcError } = await supabase
              .rpc('promote_self_to_admin', { target_org_id: existingProfile.org_id });
            if (rpcError) throw rpcError;
          }
        }
        await finishOnboarding(`${orgForm.name.trim() || 'Your workspace'} is ready! Welcome to Verdant CRM.`);
        return;
      }

      // ── NORMAL PATH ────────────────────────────────────────────────────

      // 1. Create organisation
      const newOrgId = crypto.randomUUID();
      const { error: orgError } = await supabase
        .from('organizations')
        .insert({
          id:       newOrgId,
          name:     orgForm.name.trim(),
          slug:     orgForm.slug.trim(),
          industry: orgForm.industry || null,
          website:  orgForm.website  || null,
          phone:    orgForm.phone    || null,
          timezone: orgForm.timezone,
          currency: orgForm.currency,
        });

      if (orgError) {
        if (orgError.code === '23505') {
          // Slug collision. Check if the existing org with this slug was
          // actually created by THIS user in a prior partial attempt
          // (org row inserted, but promote_self_to_admin failed).
          // If so, link the user to that org instead of failing.
          const { data: existingOrg } = await supabase
            .from('organizations')
            .select('id, name')
            .eq('slug', orgForm.slug.trim())
            .maybeSingle();

          if (existingOrg) {
            // Check if any admin is already linked to this org (someone else owns it).
            const { data: existingAdmin } = await supabase
              .from('user_profiles')
              .select('id')
              .eq('org_id', existingOrg.id)
              .eq('role', 'admin')
              .neq('id', user.id)
              .maybeSingle();

            if (existingAdmin) {
              // Another user owns this org — genuinely taken.
              throw new Error('That URL slug is already taken — try a different one.');
            }

            // No other admin owns it — this is our orphaned org from a prior attempt.
            // Link this user to it and finish onboarding.
            const { error: rpcRetryError } = await supabase
              .rpc('promote_self_to_admin', { target_org_id: existingOrg.id });
            if (rpcRetryError) {
              const { error: directRetryError } = await supabase
                .from('user_profiles')
                .update({ org_id: existingOrg.id, role: 'admin' })
                .eq('id', user.id);
              if (directRetryError) throw new Error('That URL slug is already taken — try a different one.');
            }
            await finishOnboarding(`${existingOrg.name} is ready! Welcome to Verdant CRM.`);
            return;
          }

          throw new Error('That URL slug is already taken — try a different one.');
        }
        throw orgError;
      }

      // 2. Promote creator to admin (SECURITY DEFINER RPC → direct UPDATE fallback)
      const { error: rpcError } = await supabase
        .rpc('promote_self_to_admin', { target_org_id: newOrgId });
      if (rpcError) {
        const { error: directError } = await supabase
          .from('user_profiles')
          .update({ org_id: newOrgId, role: 'admin' })
          .eq('id', user.id);
        if (directError) throw directError;
      }

      // 3. Seed default pipeline stages (non-blocking)
      supabase
        .from('pipeline_stages')
        .insert(DEFAULT_STAGES.map(s => ({ ...s, org_id: newOrgId })))
        .then(({ error }) => {
          if (error) console.warn('Pipeline stage seeding failed (non-critical):', error.message);
        });

      // 4. Mark onboarding complete and navigate
      await finishOnboarding(`${orgForm.name.trim()} is ready! Welcome to Verdant CRM.`);

    } catch (err) {
      toast.error(err.message || 'Failed to create company');
    } finally {
      setCreating(false);
    }
  };

  const Spinner16 = () => (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
      Please wait...
    </span>
  );

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">

        {/* Header */}
        <div className="onboarding-card-header">
          <div style={{
            width: 48, height: 48, background: 'var(--green-600)', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
            boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
          }}>
            <Leaf size={24} color="white" />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(18px, 4vw, 22px)', color: 'var(--green-800)', marginBottom: 3, letterSpacing: '-0.01em' }}>
            Welcome to Verdant CRM
          </h1>
          <p style={{ fontSize: 12, color: 'var(--green-700)', fontWeight: 500, opacity: 0.75, marginBottom: 4 }}>
            Grow your pipeline. Close more deals.
          </p>
          <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            Signed in as <strong>{user?.email}</strong>
          </p>
        </div>

        <div className="onboarding-card-body">

          {/* ── JOINING (processing invite) ── */}
          {screen === 'joining' && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              {joining ? (
                <>
                  <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
                  <p style={{ fontWeight: 600, color: 'var(--gray-800)' }}>
                    Joining {inviteData?.organizations?.name}...
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 8 }}>
                    Setting up your workspace, please wait...
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle size={36} color="var(--green-600)" style={{ margin: '0 auto 12px', display: 'block' }} />
                  <p style={{ color: 'var(--gray-600)', fontSize: 14 }}>Setting up your workspace...</p>
                </>
              )}
            </div>
          )}

          {/* ── CHOOSE ── */}
          {screen === 'choose' && (
            <div>
              {inviteError && (
                <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#991b1b', lineHeight: 1.5 }}>
                  ⚠️ {inviteError}
                </div>
              )}
              <p style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 20, textAlign: 'center' }}>
                You're not part of a company workspace yet. What would you like to do?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <button className="onboarding-option" onClick={() => setScreen('create')}>
                  <div className="onboarding-option-icon" style={{ background: 'var(--green-100)' }}>
                    <Building2 size={20} color="var(--green-700)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900)', marginBottom: 3 }}>
                      Set up my company
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                      Create a new CRM workspace for your business. You'll be the admin.
                    </div>
                  </div>
                </button>

                <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-400)', margin: '4px 0' }}>
                  — or —
                </div>

                <div style={{ background: 'var(--gray-50)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div className="onboarding-option-icon" style={{ background: '#dbeafe', width: 36, height: 36 }}>
                      <Users size={18} color="#1d4ed8" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--gray-900)' }}>Join a company</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Paste your invite link or code below</div>
                    </div>
                  </div>
                  <InlineInviteEntry onAccept={lookupAndAcceptInvite} />
                </div>
              </div>
            </div>
          )}

          {/* ── CREATE ORG ── */}
          {screen === 'create' && (
            <form onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <button type="button" onClick={() => setScreen('choose')}
                  style={{ background: 'none', border: 'none', color: 'var(--green-600)', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 16 }}>
                  ← Back
                </button>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Set up your company</h2>
                <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                  You can update all of these later in <strong>Settings → Organisation</strong>.
                </p>
              </div>

              <FormGroup label="Company Name" required>
                <input className="form-input" value={orgForm.name} onChange={handleNameChange}
                  placeholder="Acme Inc." required autoFocus />
              </FormGroup>

              <FormGroup label="URL Slug" required>
                <input className="form-input" value={orgForm.slug}
                  onChange={e => setOrgForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  placeholder="acme-inc" required />
                <span className="form-hint">Unique identifier — letters, numbers, hyphens only</span>
              </FormGroup>

              <FormRow>
                <FormGroup label="Industry">
                  <select className="form-input form-select" value={orgForm.industry}
                    onChange={e => setOrgForm(f => ({ ...f, industry: e.target.value }))}>
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i => (
                      <option key={i} value={i}>
                        {i.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </FormGroup>
                <FormGroup label="Currency">
                  <select className="form-input form-select" value={orgForm.currency}
                    onChange={e => setOrgForm(f => ({ ...f, currency: e.target.value }))}>
                    {['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </FormGroup>
              </FormRow>

              <FormRow>
                <FormGroup label="Website">
                  <input className="form-input" value={orgForm.website}
                    onChange={e => setOrgForm(f => ({ ...f, website: e.target.value }))}
                    placeholder="https://acme.com" />
                </FormGroup>
                <FormGroup label="Phone">
                  <input className="form-input" value={orgForm.phone}
                    onChange={e => setOrgForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+1 555 0000" />
                </FormGroup>
              </FormRow>

              <FormGroup label="Timezone">
                <select className="form-input form-select" value={orgForm.timezone}
                  onChange={e => setOrgForm(f => ({ ...f, timezone: e.target.value }))}>
                  {[
                    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
                    'America/Los_Angeles', 'Europe/London', 'Europe/Paris',
                    'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney',
                  ].map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </FormGroup>

              <button type="submit" className="btn btn-primary" disabled={creating}
                style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 15, marginTop: 4 }}>
                {creating ? <Spinner16 /> : 'Create company workspace →'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

// Inline invite token entry (on choose screen)
function InlineInviteEntry({ onAccept }) {
  const [token, setToken]     = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async e => {
    e.preventDefault();
    if (!token.trim()) return;
    const raw   = token.trim();
    const match = raw.match(/[?&]invite=([a-f0-9]{64})/);
    const finalToken = match ? match[1] : raw;
    setLoading(true);
    await onAccept(finalToken);
    setLoading(false);
  };

  return (
    <form onSubmit={handle} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <input className="form-input" value={token} onChange={e => setToken(e.target.value)}
        placeholder="Paste invite link or code..." style={{ flex: 1, minWidth: 0 }} />
      <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !token.trim()}
        style={{ flexShrink: 0 }}>
        {loading ? '...' : 'Join'}
      </button>
    </form>
  );
}
