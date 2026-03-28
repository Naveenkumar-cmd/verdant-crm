// src/components/layout/Header.js
import React from 'react';
import { Menu } from 'lucide-react';
import { toggleSidebar } from './Sidebar';
import { useAuth } from '../../context/AuthContext';

export default function Header({ title, subtitle }) {
  const { organization } = useAuth();

  return (
    <header className="app-header">
      {/* Hamburger — mobile only */}
      <button className="hamburger-btn" onClick={toggleSidebar} aria-label="Open menu">
        <Menu size={22} />
      </button>

      {/* Page title */}
      <div className="header-title">
        {title && (
          <>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Org name pill — desktop only */}
      {organization?.name && (
        <div className="hide-mobile" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 100,
          background: 'var(--green-50)', border: '1px solid var(--green-100)',
          fontSize: 12, fontWeight: 600, color: 'var(--green-700)',
          flexShrink: 0, maxWidth: 200, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--green-500)', flexShrink: 0,
          }} />
          {organization.name}
        </div>
      )}
    </header>
  );
}
