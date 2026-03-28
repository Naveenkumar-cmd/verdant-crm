// src/components/modules/EmailComposer.js
//
// Email composer — slides up from bottom-right corner.
// Sends via Supabase Edge Function (Resend) and logs as an Activity.
//
// Props:
//   isOpen, onClose, defaultTo, defaultToName,
//   relatedToType, relatedToId, onSent
//
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { Send, X, ChevronDown, ChevronUp, Mail, Clock, AlertCircle } from 'lucide-react';

const TEMPLATES = [
  {
    label: 'Introduction',
    subject: 'Introduction from {{sender_name}} at {{org_name}}',
    body: `Hi {{first_name}},

I hope this message finds you well. My name is {{sender_name}} from {{org_name}}.

I wanted to reach out to introduce myself and learn more about your business. We help teams with [your value proposition], and I thought there might be a great fit.

Would you be open to a brief 15-minute call this week?

Best regards,
{{sender_name}}
{{org_name}}`,
  },
  {
    label: 'Follow-up',
    subject: 'Following up – {{org_name}}',
    body: `Hi {{first_name}},

I wanted to follow up on my previous message. I'll keep this short.

Would any of these times work for a quick call?
• [Day], [Time]
• [Day], [Time]

If now isn't the right time, no worries at all.

Best,
{{sender_name}}`,
  },
  {
    label: 'Proposal sent',
    subject: 'Your proposal from {{org_name}}',
    body: `Hi {{first_name}},

As discussed, please find attached your proposal from {{org_name}}.

Key highlights:
• [Point 1]
• [Point 2]
• [Point 3]

This proposal is valid until [date]. Happy to walk you through it or answer any questions.

Best regards,
{{sender_name}}
{{org_name}}`,
  },
  {
    label: 'Meeting confirmation',
    subject: 'Meeting confirmed – {{org_name}}',
    body: `Hi {{first_name}},

I'm looking forward to our meeting!

Details:
• Date: [date]
• Time: [time]
• Location / Link: [location or video link]

Please let me know if you need to reschedule.

See you soon,
{{sender_name}}`,
  },
  {
    label: 'Thank you',
    subject: 'Thank you for your time, {{first_name}}',
    body: `Hi {{first_name}},

Thank you for taking the time to speak with me today.

Quick summary:
• [Key point 1]
• [Key point 2]

Next steps:
• [Action item — your side]
• [Action item — our side]

Please reach out any time if you have questions.

Best regards,
{{sender_name}}
{{org_name}}`,
  },
  {
    label: 'Check-in',
    subject: 'Checking in – {{org_name}}',
    body: `Hi {{first_name}},

I just wanted to check in and see how things are going.

Has anything changed on your end with [specific need]? I'd love to reconnect.

Best,
{{sender_name}}`,
  },
];

function applyVars(str, vars) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || `{{${k}}}`);
}

function EmailHistoryItem({ email }) {
  const [expanded, setExpanded] = useState(false);
  const date = email.activity_date
    ? new Date(email.activity_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <div style={{ borderBottom: '1px solid var(--color-border)', padding: '12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--green-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Mail size={14} color="var(--green-600)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-800)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {email.email_subject || email.subject || '(no subject)'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>To: {email.email_to}</span>
            <span>·</span>
            <span>{date}</span>
            {email.email_status && (
              <span style={{
                background: email.email_status === 'sent' ? 'var(--green-50)' : '#fee2e2',
                color: email.email_status === 'sent' ? 'var(--green-700)' : 'var(--red-500)',
                padding: '1px 6px', borderRadius: 100, fontSize: 10, fontWeight: 600,
              }}>
                {email.email_status}
              </span>
            )}
          </div>
        </div>
        <span style={{ color: 'var(--gray-400)', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </div>
      {expanded && email.email_body_text && (
        <div style={{ marginTop: 10, marginLeft: 40, padding: '12px 14px', background: 'var(--gray-50)', borderRadius: 8, fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.7, whiteSpace: 'pre-wrap', borderLeft: '3px solid var(--green-200)' }}>
          {email.email_body_text}
        </div>
      )}
    </div>
  );
}

export default function EmailComposer({ isOpen, onClose, defaultTo = '', defaultToName = '', relatedToType = null, relatedToId = null, onSent }) {
  const { profile, organization } = useAuth();

  const [to,      setTo]      = useState('');
  const [cc,      setCc]      = useState('');
  const [subject, setSubject] = useState('');
  const [body,    setBody]    = useState('');
  const [showCc,  setShowCc]  = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('compose');
  const [history,   setHistory]   = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const vars = {
    first_name:  defaultToName?.split(' ')[0] || 'there',
    sender_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '',
    org_name:    organization?.name || 'our company',
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOpen) {
      setTo(defaultTo || '');
      setCc(''); setSubject(''); setBody('');
      setShowCc(false); setTemplateOpen(false);
      setActiveTab('compose');
    }
  }, [isOpen, defaultTo]);

  const loadHistory = useCallback(async () => {
    if (!relatedToId || !profile?.org_id) return;
    setHistoryLoading(true);
    const { data } = await supabase.from('activities')
      .select('id, subject, email_subject, email_to, email_body_text, email_status, activity_date')
      .eq('org_id', profile.org_id).eq('type', 'email')
      .eq('related_to_type', relatedToType).eq('related_to_id', relatedToId)
      .order('activity_date', { ascending: false }).limit(30);
    setHistory(data || []);
    setHistoryLoading(false);
  }, [relatedToId, relatedToType, profile?.org_id]);

  // eslint-disable-next-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab === 'history') loadHistory(); }, [activeTab, loadHistory]);

  const applyTemplate = t => { setSubject(applyVars(t.subject, vars)); setBody(applyVars(t.body, vars)); setTemplateOpen(false); };

  const handleSend = async () => {
    if (!to.trim())      { toast.error('Recipient email is required'); return; }
    if (!subject.trim()) { toast.error('Subject is required'); return; }
    if (!body.trim())    { toast.error('Email body cannot be empty'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) { toast.error('Please enter a valid email address'); return; }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: to.trim(), cc: cc.trim() || null,
          subject: subject.trim(), body_text: body.trim(),
          body_html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#374151;max-width:600px">${body.trim().replace(/\n/g, '<br/>')}</div>`,
          related_to_type: relatedToType, related_to_id: relatedToId,
          org_id: profile?.org_id, sent_by_id: profile?.id,
          sender_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
          sender_email: profile?.email,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Email sent to ${to.trim()}`);
      onSent?.();
      onClose();
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('RESEND_API_KEY') || msg.includes('not configured')) {
        toast.error('Email sending not set up yet. Add RESEND_API_KEY in Supabase → Edge Functions → Secrets.', { duration: 8000 });
      } else {
        toast.error(`Failed to send: ${msg}`);
      }
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const canSend = to.trim() && subject.trim() && body.trim() && !sending;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300, backdropFilter: 'blur(1px)' }} />
      <div style={{
        position: 'fixed', bottom: 0, right: 0,
        width: 'min(560px, 100vw)', maxHeight: '88vh',
        background: 'white', boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
        zIndex: 301, display: 'flex', flexDirection: 'column',
        borderRadius: '16px 16px 0 0', overflow: 'hidden',
        animation: 'drawerSlideIn 0.2s ease-out',
      }}>

        {/* ── Header bar ── */}
        <div style={{ padding: '12px 18px', background: '#0f2318', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <Mail size={16} color="rgba(255,255,255,0.7)" />
          <span style={{ color: 'white', fontWeight: 600, fontSize: 14, flex: 1 }}>
            New Email
            {defaultToName && <span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.45)', marginLeft: 8 }}>→ {defaultToName}</span>}
          </span>
          {relatedToId && (
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
              {['compose','history'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                  background: activeTab === tab ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: activeTab === tab ? 'white' : 'rgba(255,255,255,0.45)',
                  border: 'none', cursor: 'pointer',
                }}>
                  {tab}
                </button>
              ))}
            </div>
          )}
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* ── COMPOSE ── */}
        {activeTab === 'compose' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {/* To */}
            <div style={{ padding: '10px 18px 0', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-400)', width: 52, flexShrink: 0 }}>To</span>
              <input type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@company.com"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, padding: '0 0 10px', background: 'transparent', color: 'var(--gray-800)' }} />
              <button onClick={() => setShowCc(v => !v)} style={{ fontSize: 11, color: 'var(--gray-400)', background: 'none', border: 'none', cursor: 'pointer', paddingBottom: 10 }}>
                CC
              </button>
            </div>

            {/* CC */}
            {showCc && (
              <div style={{ padding: '8px 18px 0', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-400)', width: 52, flexShrink: 0 }}>CC</span>
                <input type="text" value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@email.com"
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, padding: '0 0 10px', background: 'transparent', color: 'var(--gray-800)' }} />
              </div>
            )}

            {/* Subject */}
            <div style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-400)', width: 52, flexShrink: 0 }}>Subject</span>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject..."
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, fontWeight: 500, padding: 0, background: 'transparent', color: 'var(--gray-800)' }} />
            </div>

            {/* Body */}
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message here..."
              style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', padding: '14px 18px', fontSize: 13, lineHeight: 1.75, color: 'var(--gray-700)', background: 'white', minHeight: 200, fontFamily: 'var(--font-sans)' }} />

            {/* Templates + footer */}
            <div style={{ position: 'relative', padding: '10px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setTemplateOpen(v => !v)} style={{
                display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--gray-600)',
                background: 'var(--gray-100)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
              }}>
                Templates {templateOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                From: {profile?.first_name} {profile?.last_name}
              </span>

              {templateOpen && (
                <div style={{ position: 'absolute', bottom: 44, left: 18, background: 'white', border: '1px solid var(--color-border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', width: 220, zIndex: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px 6px', fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--color-border)' }}>
                    Email Templates
                  </div>
                  {TEMPLATES.map(t => (
                    <button key={t.label} onClick={() => applyTemplate(t)} style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px',
                      fontSize: 13, color: 'var(--gray-700)', background: 'none', border: 'none',
                      cursor: 'pointer', borderBottom: '1px solid var(--gray-50)',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--green-50)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Send bar */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--color-border)', background: 'var(--gray-50)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <button onClick={handleSend} disabled={!canSend} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 8,
                background: 'var(--green-600)', color: 'white', border: 'none',
                cursor: canSend ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600,
                opacity: canSend ? 1 : 0.5, transition: 'opacity 0.15s',
              }}>
                {sending
                  ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> Sending...</>
                  : <><Send size={14} /> Send</>}
              </button>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--gray-400)' }}>{body.length > 0 ? `${body.length} chars` : ''}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--gray-400)' }}>
                <AlertCircle size={11} /> Sent via Resend
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {activeTab === 'history' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px', WebkitOverflowScrolling: 'touch' }}>
            {historyLoading ? (
              <div style={{ padding: '32px 0', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
            ) : history.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <Clock size={28} color="var(--gray-200)" style={{ margin: '0 auto 10px', display: 'block' }} />
                <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 12 }}>No emails sent to this record yet.</p>
                <button onClick={() => setActiveTab('compose')} style={{ fontSize: 13, color: 'var(--green-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  Compose the first email →
                </button>
              </div>
            ) : (
              <div style={{ paddingBottom: 24 }}>
                <p style={{ fontSize: 12, color: 'var(--gray-400)', padding: '12px 0 4px' }}>
                  {history.length} email{history.length !== 1 ? 's' : ''} sent to this record
                </p>
                {history.map(e => <EmailHistoryItem key={e.id} email={e} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
