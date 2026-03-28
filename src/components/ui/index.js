// src/components/ui/index.js
import React, { useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

// ============================================================
// MODAL
// ============================================================
export function Modal({ isOpen, onClose, title, size = 'md', children, footer }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal-${size}`}>
        {title && (
          <div className="modal-header">
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h3>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }}>
              <X size={16} />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ============================================================
// CONFIRM DIALOG
// ============================================================
export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Delete', danger = true }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: danger ? '#fee2e2' : 'var(--green-100)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <AlertTriangle size={22} color={danger ? 'var(--red-500)' : 'var(--green-600)'} />
          </div>
          <h3 style={{ marginBottom: 8 }}>{title}</h3>
          <p style={{ color: 'var(--gray-500)', fontSize: 14, marginBottom: 24 }}>{message}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => { onConfirm(); onClose(); }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// BADGE
// ============================================================
export function Badge({ children, variant = 'gray' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

// Status badge helpers
const LEAD_STATUS_COLORS = {
  new: 'blue', contacted: 'purple', qualified: 'green',
  unqualified: 'gray', converted: 'amber', lost: 'red',
};
const TICKET_STATUS_COLORS = {
  open: 'blue', in_progress: 'amber', pending_customer: 'purple',
  resolved: 'green', closed: 'gray',
};
const PRIORITY_COLORS = { low: 'gray', medium: 'blue', high: 'amber', urgent: 'red', critical: 'red' };

export function LeadStatusBadge({ status }) {
  return <Badge variant={LEAD_STATUS_COLORS[status] || 'gray'}>{status?.replace('_', ' ')}</Badge>;
}
export function TicketStatusBadge({ status }) {
  return <Badge variant={TICKET_STATUS_COLORS[status] || 'gray'}>{status?.replace(/_/g, ' ')}</Badge>;
}
export function PriorityBadge({ priority }) {
  return <Badge variant={PRIORITY_COLORS[priority] || 'gray'}>{priority}</Badge>;
}

// ============================================================
// SPINNER
// ============================================================
export function Spinner({ size = 20 }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
      <div className="spinner" style={{ width: size, height: size }} />
    </div>
  );
}

// ============================================================
// FORM ROW — collapses to 1 column on small screens via CSS class
// ============================================================
export function FormRow({ children, cols = 2 }) {
  return (
    <div className={cols === 3 ? 'form-row form-row-3' : 'form-row'}>
      {children}
    </div>
  );
}

// ============================================================
// FORM GROUP
// ============================================================
export function FormGroup({ label, required, hint, error, children }) {
  return (
    <div className="form-group">
      {label && <label className={`form-label${required ? ' required' : ''}`}>{label}</label>}
      {children}
      {hint  && <span className="form-hint">{hint}</span>}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

// ============================================================
// EMPTY STATE
// ============================================================
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={48} />}
      <h3>{title}</h3>
      {description && <p style={{ marginTop: 8 }}>{description}</p>}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}

// ============================================================
// AVATAR
// ============================================================
export function Avatar({ name, size = 32, color = 'var(--green-600)' }) {
  const initials = name
    ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  return (
    <div style={{
      width: size, height: size, background: color, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: 'white',
      flexShrink: 0, userSelect: 'none',
    }}>
      {initials}
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================
export function formatCurrency(amount, currency = 'USD') {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}
