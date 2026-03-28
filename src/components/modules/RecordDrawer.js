// src/components/modules/RecordDrawer.js
//
// Slide-in right panel: record details + notes + email compose button.
// Used on Leads, Contacts, Accounts, Deals, Activities, Products, Quotes, Campaigns, Tickets.
//
import React, { useState, useEffect } from 'react';
import { X, Pencil, ArrowRightLeft, Mail } from 'lucide-react';
import NotesPanel from './NotesPanel';
import EmailComposer from './EmailComposer';

export default function RecordDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  badgeEl,
  relatedType,
  relatedId,
  onEdit,
  onConvert,
  fields = [],
  // Email props — if provided, shows Send Email button
  emailTo   = null,   // recipient email address
  emailName = null,   // recipient display name
}) {
  const [composerOpen, setComposerOpen] = useState(false);

  // Lock body scroll when open
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => { if (!composerOpen) onClose(); }}
        style={{
          position: 'fixed', inset: 0,
          background: composerOpen ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.35)',
          zIndex: 200,
          backdropFilter: 'blur(1px)',
          animation: 'fadeIn 0.15s ease-out',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(480px, 100vw)',
        background: 'var(--color-surface)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        zIndex: 201,
        display: 'flex', flexDirection: 'column',
        animation: 'drawerSlideIn 0.22s ease-out',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0,
        }}>
          {/* Initials avatar */}
          <div style={{
            width: 40, height: 40, borderRadius: '50%', background: 'var(--green-600)',
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: 'white',
          }}>
            {(title || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--gray-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{subtitle}</div>}
            {badgeEl && <div style={{ marginTop: 6 }}>{badgeEl}</div>}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {onConvert && (
              <button onClick={onConvert} className="btn btn-sm" title="Convert lead"
                style={{ background: 'var(--green-50)', color: 'var(--green-700)', border: '1px solid var(--green-200)', gap: 4 }}>
                <ArrowRightLeft size={13} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Convert</span>
              </button>
            )}
            {emailTo && (
              <button onClick={() => setComposerOpen(true)} className="btn btn-sm" title="Send email"
                style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe', gap: 4 }}>
                <Mail size={13} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Email</span>
              </button>
            )}
            {onEdit && (
              <button onClick={onEdit} className="btn btn-secondary btn-sm" title="Edit" style={{ gap: 4 }}>
                <Pencil size={13} />
                <span style={{ fontSize: 12 }}>Edit</span>
              </button>
            )}
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 6 }} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 32px', WebkitOverflowScrolling: 'touch' }}>
          {/* Fields grid */}
          {fields.filter(f => f.value).length > 0 && (
            <div style={{ padding: '16px 20px 0' }}>
              <div className="drawer-fields-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px 20px' }}>
                {fields.filter(f => f.value).map((f, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                      {f.label}
                    </div>
                    <div style={{ fontSize: 13, color: f.highlight ? 'var(--green-700)' : 'var(--gray-800)', fontWeight: f.highlight ? 700 : 400, wordBreak: 'break-word' }}>
                      {f.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes panel */}
          <div style={{ padding: '0 20px' }}>
            <NotesPanel relatedType={relatedType} relatedId={relatedId} />
          </div>
        </div>
      </div>

      {/* Email composer — slides up over the drawer */}
      {emailTo && (
        <EmailComposer
          isOpen={composerOpen}
          onClose={() => setComposerOpen(false)}
          defaultTo={emailTo}
          defaultToName={emailName || title}
          relatedToType={relatedType}
          relatedToId={relatedId}
          onSent={() => setComposerOpen(false)}
        />
      )}
    </>
  );
}
