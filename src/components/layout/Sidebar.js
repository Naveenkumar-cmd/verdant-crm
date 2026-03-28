// src/components/layout/Sidebar.js
import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, Building2, UserCircle, TrendingUp,
  CheckSquare, Activity, Package, FileText, Megaphone,
  Headphones, Settings, LogOut, ChevronDown, ChevronRight, Leaf, UserPlus
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard',  path: '/app',         icon: LayoutDashboard },
  { label: 'Leads',      path: '/leads',       icon: Users },
  { label: 'Contacts',   path: '/contacts',    icon: UserCircle },
  { label: 'Accounts',   path: '/accounts',    icon: Building2 },
  { label: 'Deals',      path: '/deals',       icon: TrendingUp },
  { label: 'Tasks',      path: '/tasks',       icon: CheckSquare },
  { label: 'Activities', path: '/activities',  icon: Activity },
  { divider: true, label: 'Sales' },
  { label: 'Products',   path: '/products',    icon: Package },
  { label: 'Quotes',     path: '/quotes',      icon: FileText },
  { divider: true, label: 'Marketing & Support' },
  { label: 'Campaigns',  path: '/campaigns',   icon: Megaphone },
  { label: 'Tickets',    path: '/tickets',     icon: Headphones },
  { divider: true, label: 'Team' },
  { label: 'Invites',    path: '/invites',     icon: UserPlus },
];

const SETTINGS_ITEMS = [
  { label: 'Organization', path: '/settings/organization' },
  { label: 'Users & Roles', path: '/settings/users' },
  { label: 'Pipeline',      path: '/settings/pipeline' },
  { label: 'Custom Fields', path: '/settings/custom-fields' },
];

// Expose toggle function via a simple pub/sub so Header can trigger it
const listeners = new Set();
export function toggleSidebar() { listeners.forEach(fn => fn()); }

export default function Sidebar() {
  const { profile, organization, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Register/deregister toggle listener
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const fn = () => setMobileOpen(v => !v);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  // Close sidebar on route change (mobile)
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Close sidebar when clicking outside (handled via backdrop)
  const closeMobile = () => setMobileOpen(false);

  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  const fullName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
    : '';
  const initials = profile
    ? `${(profile.first_name || '?')[0]}${(profile.last_name || '')[0] || ''}`.toUpperCase()
    : '?';

  const navLinkStyle = ({ isActive }) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', borderRadius: 8, fontSize: 13.5,
    fontWeight: isActive ? 600 : 400,
    color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
    background: isActive ? 'var(--green-700)' : 'transparent',
    textDecoration: 'none', transition: 'all 0.12s ease', marginBottom: 2,
  });

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="sidebar-backdrop visible" onClick={closeMobile} />
      )}

      <aside className={`sidebar${mobileOpen ? ' open' : ''}`}>
        {/* Logo */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, background: 'var(--green-600)', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Leaf size={18} color="white" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>
                Verdant
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                CRM
              </div>
            </div>
          </div>
          {organization && (
            <div style={{
              marginTop: 12, padding: '6px 10px', background: 'rgba(255,255,255,0.06)',
              borderRadius: 6, fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {organization.name}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          {NAV_ITEMS.map((item, i) => {
            if (item.divider) return (
              <div key={i} style={{
                padding: '14px 8px 4px', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
              }}>
                {item.label}
              </div>
            );
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} end={item.path === '/app'} style={navLinkStyle}>
                {({ isActive }) => (
                  <><Icon size={16} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.8 }} />{item.label}</>
                )}
              </NavLink>
            );
          })}

          {/* Settings collapsible */}
          <div style={{ marginTop: 4 }}>
            <button
              onClick={() => setSettingsOpen(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8, fontSize: 13.5, fontWeight: 400,
                color: 'rgba(255,255,255,0.55)', background: 'transparent',
                border: 'none', cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              <Settings size={16} style={{ opacity: 0.8 }} />
              <span style={{ flex: 1, textAlign: 'left' }}>Settings</span>
              {settingsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {settingsOpen && (
              <div style={{ paddingLeft: 12 }}>
                {SETTINGS_ITEMS.map(s => (
                  <NavLink key={s.path} to={s.path} style={({ isActive }) => ({
                    display: 'block', padding: '7px 10px', borderRadius: 6, fontSize: 13,
                    color: isActive ? 'white' : 'rgba(255,255,255,0.45)',
                    background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                    textDecoration: 'none', marginBottom: 1,
                  })}>
                    {s.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* User profile */}
        <div style={{
          padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, background: 'var(--green-600)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fullName}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>
              {profile?.role?.replace('_', ' ')}
            </div>
          </div>
          <button onClick={handleSignOut} title="Sign out" style={{
            background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)',
            cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex',
          }}>
            <LogOut size={14} />
          </button>
        </div>
      </aside>
    </>
  );
}
