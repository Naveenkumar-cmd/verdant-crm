// src/pages/LandingPage.js
// Public marketing landing page.
// Auth-aware: logged-in + onboarded users see a "Go to your CRM" banner
// instead of the sign-in / register CTAs. The landing page always renders
// immediately — it never shows a spinner waiting for auth to resolve.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  {
    icon: '🎯',
    title: 'Lead Management',
    desc: 'Capture, qualify, and convert leads into customers. Track every interaction from first touch to closed deal.',
  },
  {
    icon: '📊',
    title: 'Visual Sales Pipeline',
    desc: 'Drag-and-drop Kanban board gives your team a live view of every deal at every stage.',
  },
  {
    icon: '👥',
    title: 'Contacts & Accounts',
    desc: 'A single source of truth for every contact and company. Always know who you talked to and what was said.',
  },
  {
    icon: '✅',
    title: 'Tasks & Activities',
    desc: 'Never miss a follow-up. Log calls, emails, and meetings. Set tasks with priorities and due dates.',
  },
  {
    icon: '📝',
    title: 'Notes on Every Record',
    desc: 'Add rich notes to leads, contacts, accounts, and deals. Notes carry over automatically on lead conversion.',
  },
  {
    icon: '✉️',
    title: 'Send Emails from CRM',
    desc: 'Compose and send emails directly from any record. Full history tracked automatically as activities.',
  },
  {
    icon: '📋',
    title: 'Quotes & Products',
    desc: 'Build a product catalogue and generate professional sales quotes with discounts and tax in seconds.',
  },
  {
    icon: '🎟️',
    title: 'Support Tickets',
    desc: 'Handle customer support in the same workspace as your sales team. Keep context in one place.',
  },
  {
    icon: '🏢',
    title: 'Multi-Tenant Workspaces',
    desc: 'Each company gets a fully isolated workspace with role-based access control for your whole team.',
  },
];

const TESTIMONIALS = [
  {
    quote: "Verdant CRM replaced three separate tools we were using. Our team actually uses it every day now — it's that intuitive.",
    name: 'Sarah Chen',
    role: 'Head of Sales, Novara Tech',
    initials: 'SC',
  },
  {
    quote: "The lead conversion flow is brilliant. Everything — contacts, notes, deals — all linked automatically. Saved us hours every week.",
    name: 'Marcus Webb',
    role: 'Founder, Webb & Partners',
    initials: 'MW',
  },
  {
    quote: "Finally a CRM that doesn't require a week of training. New reps are productive on day one. The mobile experience is excellent too.",
    name: 'Priya Nair',
    role: 'VP Operations, Solaris Group',
    initials: 'PN',
  },
];

// ── Returning-user banner ─────────────────────────────────────────────────────
// Shown at the very top of the page when the user has an active session.
// Dismissed with a close button; navigates to /app on the CTA click.
function ReturningUserBanner({ profile, onDismiss }) {
  const navigate = useNavigate();
  const firstName = profile?.first_name;
  const greeting  = firstName ? `Welcome back, ${firstName}!` : 'Welcome back!';

  return (
    <div style={{
      background: 'var(--green-600)',
      color: 'white',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      flexWrap: 'wrap',
      position: 'relative',
      zIndex: 100,
    }}>
      <span style={{ fontSize: 14, fontWeight: 500 }}>
        🌿 {greeting} Your session is still active.
      </span>
      <button
        onClick={() => navigate('/app')}
        style={{
          background: 'white',
          color: 'var(--green-700)',
          border: 'none',
          borderRadius: 7,
          padding: '7px 18px',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        Go to your CRM →
      </button>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.8)',
            fontSize: 18,
            cursor: 'pointer',
            lineHeight: 1,
            padding: '4px 6px',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function LandingPage() {
  usePageTitle('Verdant CRM – Smart CRM for Growing Businesses');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Auth state — never blocks rendering; banner appears once auth resolves.
  const { user, profile, loading, isOnboarded } = useAuth();

  // Show the returning-user banner when:
  //   • Auth has resolved (not loading)
  //   • There is a logged-in, onboarded user
  //   • The user hasn't dismissed the banner this session
  const showBanner = !loading && !!user && isOnboarded && !bannerDismissed;

  // When a logged-in user is present, swap the nav/hero CTAs so they
  // see "Go to CRM" instead of "Sign in / Get started".
  const isLoggedIn = !loading && !!user;

  return (
    <div className="lp-root">

      {/* ── RETURNING USER BANNER ────────────────────────────────── */}
      {showBanner && (
        <ReturningUserBanner
          profile={profile}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <Link to="/" className="lp-logo">
            <div className="lp-logo-mark">🌿</div>
            <span className="lp-logo-text">Verdant CRM</span>
          </Link>

          <div className="lp-nav-links hide-mobile-flex">
            <a href="#features" className="lp-nav-link">Features</a>
            <Link to="/contact" className="lp-nav-link">Contact</Link>
          </div>

          <div className="lp-nav-actions hide-mobile-flex">
            {isLoggedIn ? (
              <Link to="/app" className="lp-btn-primary">Go to CRM →</Link>
            ) : (
              <>
                <Link to="/login"    className="lp-btn-ghost">Sign in</Link>
                <Link to="/register" className="lp-btn-primary">Get started free</Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="lp-hamburger show-mobile"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label="Menu"
          >
            <span /><span /><span />
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lp-mobile-menu">
            <a href="#features" className="lp-mobile-link" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <Link to="/contact" className="lp-mobile-link" onClick={() => setMobileMenuOpen(false)}>Contact</Link>
            <div className="lp-mobile-actions">
              {isLoggedIn ? (
                <Link to="/app" className="lp-btn-primary" onClick={() => setMobileMenuOpen(false)}>Go to CRM →</Link>
              ) : (
                <>
                  <Link to="/login"    className="lp-btn-ghost"   onClick={() => setMobileMenuOpen(false)}>Sign in</Link>
                  <Link to="/register" className="lp-btn-primary"  onClick={() => setMobileMenuOpen(false)}>Get started free</Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-hero-bg" aria-hidden="true" />
        <div className="lp-container">
          <div className="lp-hero-badge">✨ Now with direct email sending from every record</div>
          <h1 className="lp-hero-h1">
            The CRM that gets out<br className="hide-mobile" /> of your way
          </h1>
          <p className="lp-hero-sub">
            Verdant CRM helps small and growing teams manage leads, contacts,
            deals, and customers — all in one clean workspace. No complexity,
            no bloat, just results.
          </p>
          <div className="lp-hero-actions">
            {isLoggedIn ? (
              <Link to="/app" className="lp-btn-primary lp-btn-lg">
                Go to your CRM →
              </Link>
            ) : (
              <Link to="/register" className="lp-btn-primary lp-btn-lg">
                Start for free →
              </Link>
            )}
            <a href="#features" className="lp-btn-outline-light lp-btn-lg">
              See all features
            </a>
          </div>
          {!isLoggedIn && (
            <p className="lp-hero-note">Free forever plan · No credit card required · Setup in 2 minutes</p>
          )}

          {/* Dashboard preview */}
          <div className="lp-hero-preview">
            <div className="lp-preview-bar">
              <span className="lp-preview-dot" style={{ background: '#ef4444' }} />
              <span className="lp-preview-dot" style={{ background: '#f59e0b' }} />
              <span className="lp-preview-dot" style={{ background: '#22c55e' }} />
              <span className="lp-preview-url">verdantcrm.app/dashboard</span>
            </div>
            <div className="lp-preview-body">
              {/* Mini dashboard mockup */}
              <div className="lp-mock-stats">
                {[
                  { label: 'Active Leads', value: '48', color: '#dbeafe' },
                  { label: 'Open Deals',   value: '12', color: '#ede9fe' },
                  { label: 'Contacts',     value: '214', color: 'var(--green-100)' },
                  { label: 'Tasks Due',    value: '7',   color: '#fce7f3' },
                ].map(s => (
                  <div key={s.label} className="lp-mock-stat" style={{ background: s.color }}>
                    <div className="lp-mock-stat-value">{s.value}</div>
                    <div className="lp-mock-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="lp-mock-pipeline">
                {[
                  { stage: 'Prospecting', cards: [{ t: 75, s: 55 }, { t: 85, s: 45 }, { t: 65, s: 60 }] },
                  { stage: 'Qualified',   cards: [{ t: 80, s: 50 }, { t: 70, s: 65 }] },
                  { stage: 'Proposal',    cards: [{ t: 90, s: 40 }, { t: 60, s: 55 }] },
                  { stage: 'Negotiation', cards: [{ t: 75, s: 60 }] },
                ].map(({ stage, cards }) => (
                  <div key={stage} className="lp-mock-column">
                    <div className="lp-mock-col-header">{stage}</div>
                    {cards.map((card, j) => (
                      <div key={j} className="lp-mock-card">
                        <div className="lp-mock-card-title" style={{ width: `${card.t}%` }} />
                        <div className="lp-mock-card-sub"   style={{ width: `${card.s}%` }} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ────────────────────────────────────────── */}
      <section className="lp-social-proof">
        <div className="lp-container">
          <p className="lp-sp-label">Trusted by growing teams worldwide</p>
          <div className="lp-sp-logos">
            {['Novara Tech', 'Webb & Partners', 'Solaris Group', 'Meridian Co.', 'BlueRidge'].map(name => (
              <span key={name} className="lp-sp-logo">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────── */}
      <section id="features" className="lp-features">
        <div className="lp-container">
          <div className="lp-section-header">
            <div className="lp-section-badge">Everything you need</div>
            <h2 className="lp-section-h2">One workspace.<br />All of CRM.</h2>
            <p className="lp-section-sub">
              Verdant CRM covers the full customer lifecycle — from first lead to loyal customer —
              without the enterprise complexity.
            </p>
          </div>
          <div className="lp-features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="lp-feature-card">
                <div className="lp-feature-icon">{f.icon}</div>
                <h3 className="lp-feature-title">{f.title}</h3>
                <p className="lp-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────── */}
      <section className="lp-how">
        <div className="lp-container">
          <div className="lp-section-header">
            <div className="lp-section-badge">Simple by design</div>
            <h2 className="lp-section-h2">Up and running<br />in minutes</h2>
          </div>
          <div className="lp-steps">
            {[
              { n: '1', title: 'Sign up free',        desc: 'Create your account and set up your company workspace in under 2 minutes. No credit card needed.' },
              { n: '2', title: 'Invite your team',    desc: 'Send invite emails to teammates with one click. They sign up, confirm their email, and join automatically.' },
              { n: '3', title: 'Import your leads',   desc: 'Add leads manually or bulk-import. Each lead can be converted to a contact, account, and deal with one click.' },
              { n: '4', title: 'Start closing deals', desc: 'Use the visual pipeline, log activities, send emails, and track every deal to close — all in one place.' },
            ].map(s => (
              <div key={s.n} className="lp-step">
                <div className="lp-step-num">{s.n}</div>
                <div>
                  <h3 className="lp-step-title">{s.title}</h3>
                  <p className="lp-step-desc">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────────────── */}
      <section className="lp-testimonials">
        <div className="lp-container">
          <div className="lp-section-header">
            <h2 className="lp-section-h2" style={{ color: 'white' }}>Teams love Verdant CRM</h2>
          </div>
          <div className="lp-testimonials-grid">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="lp-testimonial">
                <p className="lp-testimonial-quote">"{t.quote}"</p>
                <div className="lp-testimonial-author">
                  <div className="lp-testimonial-avatar">{t.initials}</div>
                  <div>
                    <div className="lp-testimonial-name">{t.name}</div>
                    <div className="lp-testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ──────────────────────────────────────────── */}
      <section className="lp-cta">
        <div className="lp-container lp-cta-inner">
          <div>
            <h2 className="lp-cta-h2">Ready to grow your pipeline?</h2>
            <p className="lp-cta-sub">Join thousands of teams closing more deals with Verdant CRM.</p>
          </div>
          <div className="lp-cta-actions">
            {isLoggedIn ? (
              <Link to="/app" className="lp-btn-primary lp-btn-lg">Go to your CRM →</Link>
            ) : (
              <Link to="/register" className="lp-btn-primary lp-btn-lg">Start for free →</Link>
            )}
            <Link to="/contact" className="lp-btn-outline-light lp-btn-lg">Talk to sales</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="lp-footer-brand">
            <div className="lp-logo">
              <div className="lp-logo-mark">🌿</div>
              <span className="lp-logo-text" style={{ color: 'white' }}>Verdant CRM</span>
            </div>
            <p className="lp-footer-tagline">Grow your pipeline.<br />Close more deals.</p>
          </div>
          <div className="lp-footer-links">
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">Product</div>
              <a href="#features" className="lp-footer-link">Features</a>
              {isLoggedIn
                ? <Link to="/app"      className="lp-footer-link">Go to CRM</Link>
                : <Link to="/register" className="lp-footer-link">Sign up free</Link>
              }
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">Account</div>
              {isLoggedIn ? (
                <Link to="/app" className="lp-footer-link">My workspace</Link>
              ) : (
                <>
                  <Link to="/login"           className="lp-footer-link">Sign in</Link>
                  <Link to="/register"        className="lp-footer-link">Create account</Link>
                  <Link to="/forgot-password" className="lp-footer-link">Reset password</Link>
                </>
              )}
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">Company</div>
              <Link to="/contact" className="lp-footer-link">Contact us</Link>
              <Link to="/contact" className="lp-footer-link">Request a demo</Link>
            </div>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <div className="lp-container">
            <span>© {new Date().getFullYear()} Verdant CRM. All rights reserved.</span>
            <span>Built for growing businesses</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
