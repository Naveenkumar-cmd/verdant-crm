import usePageTitle from '../hooks/usePageTitle';
// src/pages/Invites.js
// Admins & managers invite teammates by email.
// Clicking "Send Invite" creates the invite record AND emails the link
// directly to the teammate — no copy-pasting required.
// The Copy link button remains as a manual fallback.
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Modal, Badge, Spinner, EmptyState, FormGroup } from '../components/ui/index';
import toast from 'react-hot-toast';
import {
  UserPlus, Copy, Trash2, Mail, CheckCircle,
  Clock, XCircle, Send,
} from 'lucide-react';

const ROLES = ['sales_rep', 'manager', 'viewer'];
const STATUS_COLORS = { pending: 'amber', accepted: 'green', expired: 'gray', cancelled: 'red' };
const STATUS_ICONS  = { pending: Clock, accepted: CheckCircle, expired: XCircle, cancelled: XCircle };

function inviteUrl(token) {
  return `${window.location.origin}/join?invite=${token}`;
}

export default function Invites() {
  const { profile, organization } = useAuth();
  usePageTitle('Team Invites');
  const orgId = profile?.org_id;

  const [invites, setInvites]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState({ email: '', role: 'sales_rep' });
  const [saving, setSaving]         = useState(false);   // creating invite
  const [copiedId, setCopiedId]     = useState(null);
  const [resendingId, setResendingId] = useState(null);  // resending email

  useEffect(() => {
    if (orgId) {
      fetchInvites();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const fetchInvites = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('org_invites')
      .select('*, invited_by_profile:user_profiles!org_invites_invited_by_fkey(first_name, last_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load invites');
    else setInvites(data || []);
    setLoading(false);
  };

  // ── Send invite email via Edge Function ──────────────────────────────────
  const sendInviteEmail = async (invite) => {
    const { data, error } = await supabase.functions.invoke('send-invite', {
      body: {
        invite_email: invite.email,
        invite_token: invite.token,
        invite_role:  invite.role,
        org_name:     organization?.name || 'your team',
        sender_name:  profile
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
          : 'Your admin',
        app_url: process.env.REACT_APP_URL || window.location.origin,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  };

  // ── Create invite + send email in one step ───────────────────────────────
  const handleCreate = async e => {
    e.preventDefault();
    if (!form.email.trim()) { toast.error('Email is required'); return; }
    setSaving(true);

    try {
      // 1. Create the invite record
      const { data: invite, error: createErr } = await supabase
        .from('org_invites')
        .insert({
          org_id: orgId,
          email:  form.email.trim().toLowerCase(),
          role:   form.role,
          invited_by: profile.id,
        })
        .select()
        .single();

      if (createErr) {
        if (createErr.code === '23505') throw new Error('A pending invite for this email already exists.');
        throw createErr;
      }

      // 2. Send the invite email
      try {
        await sendInviteEmail(invite);
        toast.success(`Invite sent to ${invite.email} ✉️`);
      } catch (emailErr) {
        // Invite was created even if email fails — show warning
        const msg = emailErr?.message || String(emailErr);
        if (msg.includes('RESEND_API_KEY') || msg.includes('not configured')) {
          toast(
            `Invite created but email not sent — Resend is not set up yet.\nCopy the link manually to share.`,
            { icon: '⚠️', duration: 7000 }
          );
        } else {
          toast(`Invite created but email failed: ${msg}\nUse Copy link to share manually.`,
            { icon: '⚠️', duration: 6000 });
        }
      }

      setShowModal(false);
      setForm({ email: '', role: 'sales_rep' });
      fetchInvites();

    } catch (err) {
      toast.error(err.message || 'Failed to create invite');
    } finally {
      setSaving(false);
    }
  };

  // ── Resend invite email to an existing pending invite ────────────────────
  const handleResendEmail = async (invite) => {
    setResendingId(invite.id);
    try {
      await sendInviteEmail(invite);
      toast.success(`Invite re-sent to ${invite.email} ✉️`);
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('RESEND_API_KEY') || msg.includes('not configured')) {
        toast.error('Email not configured. Set up Resend first (see README).');
      } else {
        toast.error(`Failed to send: ${msg}`);
      }
    } finally {
      setResendingId(null);
    }
  };

  const cancelInvite = async invite => {
    const { error } = await supabase
      .from('org_invites')
      .update({ status: 'cancelled' })
      .eq('id', invite.id);
    if (error) toast.error(error.message);
    else { toast.success('Invite cancelled'); fetchInvites(); }
  };

  const copyLink = invite => {
    const url = inviteUrl(invite.token);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedId(invite.id);
        toast.success('Invite link copied!');
        setTimeout(() => setCopiedId(null), 2500);
      });
    } else {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
      toast.success('Invite link copied!');
    }
  };

  const pendingCount  = invites.filter(i => i.status === 'pending').length;
  const acceptedCount = invites.filter(i => i.status === 'accepted').length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Team Invites</h1>
          <p className="page-subtitle">{pendingCount} pending · {acceptedCount} accepted</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <UserPlus size={16} /> Invite Teammate
        </button>
      </div>

      {/* How-it-works banner */}
      <div className="invite-info-banner">
        <Mail size={18} color="var(--green-600)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>How it works:</strong> Enter your teammate's email and choose their role — an invite
          email is sent to them automatically. They click the link, sign up using that email address,
          confirm it, sign in, and are added to <strong>{organization?.name}</strong> instantly.
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? <Spinner /> : invites.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No invites yet"
            description="Invite your first teammate — they'll receive an email with a sign-up link."
            action={
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                <UserPlus size={14} /> Invite Teammate
              </button>
            }
          />
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="hide-mobile">Invited By</th>
                  <th className="hide-mobile">Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map(invite => {
                  const StatusIcon      = STATUS_ICONS[invite.status] || Clock;
                  const isExpired       = invite.status === 'pending' && new Date(invite.expires_at) < new Date();
                  const effectiveStatus = isExpired ? 'expired' : invite.status;
                  const wasCopied       = copiedId === invite.id;
                  const isResending     = resendingId === invite.id;
                  const isPendingActive = invite.status === 'pending' && !isExpired;

                  return (
                    <tr key={invite.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{invite.email}</div>
                        <div className="show-mobile" style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                          Expires {new Date(invite.expires_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--gray-600)' }}>
                        {invite.role.replace('_', ' ')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <StatusIcon size={13} />
                          <Badge variant={STATUS_COLORS[effectiveStatus] || 'gray'}>
                            {effectiveStatus}
                          </Badge>
                        </div>
                      </td>
                      <td className="hide-mobile" style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                        {invite.invited_by_profile
                          ? `${invite.invited_by_profile.first_name} ${invite.invited_by_profile.last_name}`
                          : '—'}
                      </td>
                      <td className="hide-mobile" style={{ fontSize: 12, color: isExpired ? 'var(--red-500)' : 'var(--gray-500)' }}>
                        {new Date(invite.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          {isPendingActive && (
                            <>
                              {/* Primary: Resend email */}
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleResendEmail(invite)}
                                disabled={isResending}
                                title="Send invite email"
                                style={{ gap: 4 }}
                              >
                                {isResending
                                  ? <><div className="spinner" style={{ width: 11, height: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} /></>
                                  : <Send size={12} />}
                                <span className="hide-mobile">
                                  {isResending ? 'Sending…' : 'Send email'}
                                </span>
                              </button>

                              {/* Secondary: Copy link fallback */}
                              <button
                                className={`btn btn-sm ${wasCopied ? 'btn-secondary' : 'btn-ghost'}`}
                                onClick={() => copyLink(invite)}
                                title="Copy invite link"
                                style={{ gap: 4 }}
                              >
                                {wasCopied ? <CheckCircle size={12} /> : <Copy size={12} />}
                                <span className="hide-mobile">
                                  {wasCopied ? 'Copied!' : 'Copy link'}
                                </span>
                              </button>
                            </>
                          )}

                          {/* Cancel (pending only) */}
                          {invite.status === 'pending' && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => cancelInvite(invite)}
                              title="Cancel invite"
                              style={{ padding: 5, color: 'var(--red-500)' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}

                          {invite.status !== 'pending' && (
                            <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create + Send invite modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Invite a teammate"
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving} style={{ gap: 7 }}>
              {saving
                ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> Sending…</>
                : <><Send size={14} /> Send Invite</>}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormGroup label="Email address" required>
            <input
              type="email"
              className="form-input"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="colleague@company.com"
              autoFocus
            />
            <span className="form-hint">
              An invite email will be sent to this address automatically.
              Your teammate must sign up using this exact email.
            </span>
          </FormGroup>

          <FormGroup label="Role">
            <select
              className="form-input form-select"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>
                  {r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </option>
              ))}
            </select>
            <span className="form-hint">
              {form.role === 'sales_rep' && 'Can create and edit their own records'}
              {form.role === 'manager'   && 'Can view and edit all records in the org'}
              {form.role === 'viewer'    && 'Read-only access to all records'}
            </span>
          </FormGroup>

          {/* What your teammate will receive */}
          <div style={{
            background: 'var(--green-50)', border: '1px solid var(--green-200)',
            borderRadius: 10, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-800)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={13} /> What your teammate will receive
            </div>
            <div style={{ fontSize: 12, color: 'var(--green-700)', lineHeight: 1.7 }}>
              A branded email from <strong>Verdant CRM</strong> with a one-click{' '}
              <strong>Accept Invite</strong> button. They sign up with their email,
              confirm it, sign in, and land straight in your workspace as a{' '}
              <strong style={{ textTransform: 'capitalize' }}>{form.role.replace('_', ' ')}</strong>.
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--gray-400)', lineHeight: 1.5 }}>
            Invite expires in 7 days. If email sending is not yet configured (Resend), the invite
            will still be created and you can copy the link manually.
          </div>
        </form>
      </Modal>
    </div>
  );
}
