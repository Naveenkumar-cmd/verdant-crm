// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/layout/Sidebar';
import Header  from './components/layout/Header';

import {
  LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, JoinPage,
} from './components/auth/AuthPage';

import LandingPage  from './pages/LandingPage';
import ContactPage  from './pages/ContactPage';
import Onboarding   from './pages/Onboarding';
import Dashboard    from './pages/Dashboard';
import Leads        from './pages/Leads';
import Contacts     from './pages/Contacts';
import Accounts     from './pages/Accounts';
import Deals        from './pages/Deals';
import Tasks        from './pages/Tasks';
import Activities   from './pages/Activities';
import Products     from './pages/Products';
import Quotes       from './pages/Quotes';
import Campaigns    from './pages/Campaigns';
import Tickets      from './pages/Tickets';
import Invites      from './pages/Invites';
import {
  OrganizationSettings, PipelineSettings,
  CustomFieldsSettings, UsersSettings,
} from './pages/Settings';

import './styles/global.css';

const PAGE_TITLES = {
  '/app':                    { title: 'Dashboard',       subtitle: 'Your CRM overview' },
  '/leads':                  { title: 'Leads',           subtitle: 'Manage incoming leads' },
  '/contacts':               { title: 'Contacts',        subtitle: 'Your contact directory' },
  '/accounts':               { title: 'Accounts',        subtitle: 'Companies and organisations' },
  '/deals':                  { title: 'Deals',           subtitle: 'Sales pipeline' },
  '/tasks':                  { title: 'Tasks',           subtitle: 'Manage your to-dos' },
  '/activities':             { title: 'Activities',      subtitle: 'Calls, emails and meetings' },
  '/products':               { title: 'Products',        subtitle: 'Product catalogue' },
  '/quotes':                 { title: 'Quotes',          subtitle: 'Sales quotes and proposals' },
  '/campaigns':              { title: 'Campaigns',       subtitle: 'Marketing campaigns' },
  '/tickets':                { title: 'Support Tickets', subtitle: 'Customer support' },
  '/invites':                { title: 'Team Invites',    subtitle: 'Invite teammates to your organisation' },
  '/settings/organization':  { title: 'Settings',        subtitle: 'Organisation profile' },
  '/settings/pipeline':      { title: 'Settings',        subtitle: 'Pipeline stages' },
  '/settings/custom-fields': { title: 'Settings',        subtitle: 'Custom fields' },
  '/settings/users':         { title: 'Settings',        subtitle: 'Users & roles' },
};

// ── Full-screen loader / error ────────────────────────────────────────────────
function FullScreenLoader() {
  const { loadError, retryLoad, user } = useAuth();
  const isError = !!user && loadError === 'error';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--color-bg)',
    }}>
      <div style={{ textAlign: 'center', padding: '0 24px' }}>
        <div style={{
          width: 52, height: 52, background: 'var(--green-600)', borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', boxShadow: '0 4px 14px rgba(22,163,74,0.25)',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
          </svg>
        </div>
        <p style={{ fontFamily: 'var(--font-display)', color: 'var(--green-800)', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          Verdant CRM
        </p>
        <p style={{ color: 'var(--gray-400)', fontSize: 12, marginBottom: 20 }}>
          Grow your pipeline. Close more deals.
        </p>
        {isError ? (
          <div style={{ maxWidth: 280, margin: '0 auto' }}>
            <p style={{ color: 'var(--gray-500)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              Something went wrong loading your account. Please try again.
            </p>
            <button
              onClick={retryLoad}
              style={{
                background: 'var(--green-600)', color: 'white', border: 'none',
                borderRadius: 8, padding: '9px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
              Try again
            </button>
          </div>
        ) : (
          <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
        )}
      </div>
    </div>
  );
}

// ── Auth callback handler ─────────────────────────────────────────────────────
// Handles email confirmation and password-reset links.
// After email confirmation, waits for auth to resolve then routes:
//   - already onboarded → /app
//   - needs onboarding  → /onboarding
//   - password reset    → /reset-password
function AuthCallback() {
  const { loading, user, isOnboarded } = useAuth();

  React.useEffect(() => {
    const hash   = window.location.hash;
    const params = new URLSearchParams(window.location.search);

    // Password reset flow — redirect immediately, no auth check needed.
    if (hash.includes('type=recovery') || params.get('type') === 'recovery') {
      window.location.replace('/reset-password');
    }
    // For email confirmation (type=signup or no type), wait for auth state
    // to resolve before deciding where to send the user (handled below).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wait for auth to resolve, then navigate to the right destination.
  React.useEffect(() => {
    const hash   = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    // Don't handle password recovery here — the effect above already redirected.
    if (hash.includes('type=recovery') || params.get('type') === 'recovery') return;

    if (loading) return; // Still resolving — wait.

    if (user && isOnboarded) {
      window.location.replace('/app');
    } else if (user) {
      window.location.replace('/onboarding');
    } else {
      // No user after auth resolved — something went wrong; send to login.
      window.location.replace('/login');
    }
  }, [loading, user, isOnboarded]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--color-bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, background: 'var(--green-600)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
          </svg>
        </div>
        <p style={{ fontFamily: 'var(--font-display)', color: 'var(--green-800)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Verdant CRM
        </p>
        <p style={{ color: 'var(--gray-500)', fontSize: 14, marginBottom: 4 }}>Email confirmed!</p>
        <p style={{ color: 'var(--gray-400)', fontSize: 12 }}>Setting up your workspace...</p>
        <div className="spinner" style={{ width: 24, height: 24, margin: '20px auto 0' }} />
      </div>
    </div>
  );
}

// ── PROTECTED ROUTE ───────────────────────────────────────────────────────────
// Guards all /app/* routes.
function ProtectedRoute({ children }) {
  const { user, loading, loadError, isOnboarded } = useAuth();

  if (loading)               return <FullScreenLoader />;
  if (!user)                 return <Navigate to="/login" replace />;
  if (loadError === 'error') return <FullScreenLoader />;
  if (!isOnboarded)          return <Navigate to="/onboarding" replace />;

  return children;
}

// ── ONBOARDING ROUTE ──────────────────────────────────────────────────────────
function OnboardingRoute() {
  const { loading, user, isOnboarded } = useAuth();

  if (loading)      return <FullScreenLoader />;
  if (!user)        return <Navigate to="/login" replace />;
  if (isOnboarded)  return <Navigate to="/app" replace />;

  return <Onboarding />;
}

// ── AUTH REDIRECT ─────────────────────────────────────────────────────────────
// Navigates logged-in users away from auth pages (login/register).
// Does NOT block the form from rendering while loading — that caused
// the "login page stuck" issue where the form appeared frozen.
function AuthRedirect() {
  const { user, loading, isOnboarded } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (loading) return;
    if (!user)   return;

    if (isOnboarded) {
      navigate('/app', { replace: true });
    } else {
      navigate('/onboarding', { replace: true });
    }
  }, [loading, user, isOnboarded, navigate]);

  return null;
}

// ── ROOT ROUTE ────────────────────────────────────────────────────────────────
// Smart landing: logged-in + onboarded users get a "Go to CRM" banner
// on the landing page. All other visitors see the normal landing page.
// We never block rendering or show a spinner here — LandingPage is always
// shown immediately; the auth state enriches it once resolved.
function RootRoute() {
  return <LandingPage />;
}

// ── APP SHELL ─────────────────────────────────────────────────────────────────
function AppShell({ children, path }) {
  const info = PAGE_TITLES[path] || {};
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Header title={info.title} subtitle={info.subtitle} />
        {children}
      </div>
    </div>
  );
}

function AppRoute({ path, element }) {
  return <AppShell path={path}>{element}</AppShell>;
}

// ── ROUTES ────────────────────────────────────────────────────────────────────
function AppRoutes() {
  const protect = (path, el) => (
    <Route
      path={path}
      element={
        <ProtectedRoute>
          <AppRoute path={path} element={el} />
        </ProtectedRoute>
      }
    />
  );

  return (
    <Routes>
      <Route path="/home"    element={<LandingPage />} />
      <Route path="/contact" element={<ContactPage />} />

      {/* Auth pages: form renders immediately, AuthRedirect navigates away if logged in */}
      <Route path="/login"    element={<><AuthRedirect /><LoginPage /></>} />
      <Route path="/register" element={<><AuthRedirect /><RegisterPage /></>} />

      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password"  element={<ResetPasswordPage />} />

      {/* Email confirmation / password-reset callback */}
      <Route path="/auth/callback"   element={<AuthCallback />} />

      {/* Invite acceptance landing */}
      <Route path="/join"            element={<JoinPage />} />

      {/* Onboarding — mandatory before any app access */}
      <Route path="/onboarding"      element={<OnboardingRoute />} />

      {/* Root: landing page with smart auth-aware banner */}
      <Route path="/" element={<RootRoute />} />

      {protect('/app',                    <Dashboard />)}
      {protect('/leads',                  <Leads />)}
      {protect('/contacts',               <Contacts />)}
      {protect('/accounts',               <Accounts />)}
      {protect('/deals',                  <Deals />)}
      {protect('/tasks',                  <Tasks />)}
      {protect('/activities',             <Activities />)}
      {protect('/products',               <Products />)}
      {protect('/quotes',                 <Quotes />)}
      {protect('/campaigns',              <Campaigns />)}
      {protect('/tickets',                <Tickets />)}
      {protect('/invites',                <Invites />)}
      {protect('/settings/organization',  <OrganizationSettings />)}
      {protect('/settings/pipeline',      <PipelineSettings />)}
      {protect('/settings/custom-fields', <CustomFieldsSettings />)}
      {protect('/settings/users',         <UsersSettings />)}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              fontFamily:   'var(--font-sans)',
              fontSize:     '14px',
              borderRadius: '10px',
              boxShadow:    '0 4px 12px rgba(0,0,0,0.1)',
            },
            success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
