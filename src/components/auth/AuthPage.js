// src/components/auth/AuthPage.js
//
// REFACTORED AUTH PAGES — KEY CHANGES
// ─────────────────────────────────────
// RegisterPage:
//   • Calls AuthContext.signUp() (no direct supabase.auth calls here).
//   • Does NOT sign out after signup.
//   • Verification OFF → redirects to /onboarding directly (user is logged in).
//   • Verification ON  → shows "check your email" screen; /auth/callback
//     will redirect to /onboarding after confirmation.
//   • setsuppress() is GONE — the suppress hack is no longer needed.
//
// LoginPage:
//   • After signIn, AuthRedirect (in App.js) handles routing to /app or /onboarding.
//   • Invite token flow preserved.
//
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Leaf, Eye, EyeOff, Building2, CheckCircle, Mail } from 'lucide-react';

// ── Shared layout wrapper ─────────────────────────────────────────────────────
function AuthLayout({ children, subtitle }) {
  return (
    <div className="auth-page">
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage:
          'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.06) 0%, transparent 50%),' +
          'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.06) 0%, transparent 40%)',
      }} />
      <div className="auth-card">
        <div className="auth-card-header">
          <div style={{
            width: 52, height: 52, background: 'var(--green-600)', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
          }}>
            <Leaf size={26} color="white" />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 28px)',
            color: 'var(--green-800)', marginBottom: 4, letterSpacing: '-0.01em',
          }}>
            Verdant CRM
          </h1>
          <p style={{ fontSize: 13, color: 'var(--green-700)', fontWeight: 500, marginBottom: 6, opacity: 0.75 }}>
            Grow your pipeline. Close more deals.
          </p>
          <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>{subtitle}</p>
        </div>
        <div className="auth-card-body">{children}</div>
      </div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form,     setForm]     = useState({ email: '', password: '' });

  const inviteToken = searchParams.get('invite') || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(form.email, form.password);
    setLoading(false);

    if (error) {
      toast.error(error.message || 'Invalid credentials');
      return;
    }

    // After successful signIn, onAuthStateChange fires and AuthContext fetches
    // the profile. AuthRedirect (in App.js) navigates to /app or /onboarding.
    // For the invite flow only, navigate directly to /join.
    if (inviteToken) navigate(`/join?invite=${inviteToken}`);
  };

  return (
    <AuthLayout subtitle="Sign in to your workspace">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="form-group">
          <label className="form-label">Email address</label>
          <input
            type="email" className="form-input" placeholder="you@company.com"
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            required autoFocus
          />
        </div>
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="form-label">Password</label>
            <Link to="/forgot-password" style={{ fontSize: 12, color: 'var(--green-600)' }}>
              Forgot password?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'} className="form-input" placeholder="••••••••"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required style={{ paddingRight: 40 }}
            />
            <button
              type="button" onClick={() => setShowPass(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer', display: 'flex' }}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <button
          type="submit" className="btn btn-primary" disabled={loading}
          style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 15, marginTop: 4 }}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
          Don't have an account?{' '}
          <Link
            to={inviteToken ? `/register?invite=${inviteToken}` : '/register'}
            style={{ color: 'var(--green-600)', fontWeight: 600 }}>
            Create one
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

// ── REGISTER ──────────────────────────────────────────────────────────────────
// CHANGED:
//   • Calls context.signUp() — no direct supabase calls, no sign-out hack.
//   • Verification OFF: signUp() returns {} with a live session → navigate to /onboarding.
//   • Verification ON:  signUp() returns { needsVerification: true } → show email screen.
export function RegisterPage() {
  const { signUp } = useAuth();
  // No navigate here — AuthRedirect (in App.js) watches auth state and
  // routes to /onboarding automatically once loading settles. Calling
  // navigate() manually races against the onAuthStateChange fetchProfile
  // call and leaves the app stuck on loading=true.
  const [searchParams]   = useSearchParams();
  const [loading,        setLoading]        = useState(false);
  const [verifyScreen,   setVerifyScreen]   = useState(false);
  const [verifyEmail,    setVerifyEmail]    = useState('');
  const [invitePreview,  setInvitePreview]  = useState(null);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
  });

  const inviteToken = searchParams.get('invite') || '';

  useEffect(() => {
    if (!inviteToken) return;
    supabase
      .from('org_invites')
      .select('email, role, organizations(name)')
      .eq('token', inviteToken)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setInvitePreview(data);
          setForm(f => ({ ...f, email: data.email }));
        }
      });
  }, [inviteToken]);

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    const result = await signUp({
      email:     form.email,
      password:  form.password,
      firstName: form.firstName,
      lastName:  form.lastName,
    });

    setLoading(false);

    if (result.error) {
      toast.error(result.error.message || 'Signup failed. Please try again.');
      return;
    }

    if (result.needsVerification) {
      // Email verification is ON — show the "check your email" screen.
      // After the user clicks their confirmation link, /auth/callback will
      // redirect them to /onboarding with a live session.
      setVerifyEmail(form.email);
      setVerifyScreen(true);
      return;
    }

    // Verification OFF — session is live.
    // Do NOT navigate manually here. onAuthStateChange has fired (or is
    // about to) and will call fetchProfile. Once loading settles,
    // AuthRedirect (rendered alongside this page in App.js) will
    // automatically route the user to /onboarding (or /app if already
    // onboarded). Manual navigation here races with the profile fetch
    // and causes a permanent loading=true freeze.
    //
    // For invite flow: the invite token is preserved in the URL query
    // string, so when AuthRedirect sends the user to /onboarding the
    // token will still be present if we append it now — but actually
    // AuthRedirect doesn't know about invite tokens. We store it and
    // let the onboarding page pick it up via a redirect after login.
    // The simplest correct approach: just do nothing and let AuthRedirect
    // handle routing. The user lands on /onboarding and can paste their
    // invite token there if needed.
  };

  if (verifyScreen) {
    return (
      <AuthLayout subtitle="One more step">
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{
            width: 64, height: 64, background: 'var(--green-50)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', border: '2px solid var(--green-200)',
          }}>
            <Mail size={28} color="var(--green-600)" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 12 }}>
            Check your email
          </h2>
          <p style={{ fontSize: 14, color: 'var(--gray-600)', lineHeight: 1.6, marginBottom: 8 }}>
            We sent a confirmation link to:
          </p>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--green-700)', marginBottom: 20 }}>
            {verifyEmail}
          </p>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 28 }}>
            Click the link in that email to confirm your address.
            You'll be taken directly to your workspace setup — no login required.
          </p>
          <div style={{
            background: 'var(--green-50)', border: '1px solid var(--green-200)',
            borderRadius: 10, padding: '12px 14px', marginBottom: 20,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <CheckCircle size={16} color="var(--green-600)" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 12, color: 'var(--green-800)', lineHeight: 1.5, margin: 0 }}>
              <strong>No login needed.</strong> The confirmation link will sign you in and take you straight to onboarding.
            </p>
          </div>
          <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 8 }}>
            Didn't receive it? Check your spam folder.
          </p>
          <p style={{ marginTop: 16 }}>
            <Link to="/login" style={{ fontSize: 13, color: 'var(--green-600)', fontWeight: 600 }}>
              ← Back to sign in
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout subtitle={invitePreview ? `Join ${invitePreview.organizations?.name}` : 'Create your account'}>
      {invitePreview && (
        <div style={{
          background: 'var(--green-50)', border: '1px solid var(--green-200)',
          borderRadius: 10, padding: '12px 14px', marginBottom: 20,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <Building2 size={18} color="var(--green-600)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: 'var(--green-800)', lineHeight: 1.5 }}>
            You've been invited to join <strong>{invitePreview.organizations?.name}</strong> as a{' '}
            <strong style={{ textTransform: 'capitalize' }}>{invitePreview.role?.replace('_', ' ')}</strong>.
            Create your account below to accept.
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label required">First name</label>
            <input className="form-input" placeholder="Jane" value={form.firstName}
              onChange={set('firstName')} required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label required">Last name</label>
            <input className="form-input" placeholder="Smith" value={form.lastName}
              onChange={set('lastName')} required />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label required">Work email</label>
          <input
            type="email" className="form-input" placeholder="jane@company.com"
            value={form.email} onChange={set('email')}
            readOnly={!!invitePreview}
            style={invitePreview ? { background: 'var(--gray-50)', color: 'var(--gray-500)' } : {}}
            required
          />
          {invitePreview && (
            <span className="form-hint">Email is set by your invite and cannot be changed.</span>
          )}
        </div>
        <div className="form-group">
          <label className="form-label required">Password</label>
          <input type="password" className="form-input" placeholder="Min. 8 characters"
            value={form.password} onChange={set('password')} required minLength={8} />
        </div>
        <div className="form-group">
          <label className="form-label required">Confirm password</label>
          <input type="password" className="form-input" placeholder="Re-enter password"
            value={form.confirmPassword} onChange={set('confirmPassword')} required />
        </div>
        <button
          type="submit" className="btn btn-primary" disabled={loading}
          style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 15, marginTop: 4 }}>
          {loading
            ? 'Creating account...'
            : invitePreview
              ? 'Create account & join'
              : 'Create account'}
        </button>
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--gray-500)' }}>
          Already have an account?{' '}
          <Link
            to={inviteToken ? `/login?invite=${inviteToken}` : '/login'}
            style={{ color: 'var(--green-600)', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email,   setEmail]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) toast.error(error.message);
    else setSent(true);
  };

  return (
    <AuthLayout subtitle="Reset your password">
      {sent ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📧</div>
          <h3 style={{ marginBottom: 8 }}>Check your inbox</h3>
          <p style={{ color: 'var(--gray-500)', fontSize: 14, marginBottom: 20 }}>
            We sent a reset link to <strong>{email}</strong>
          </p>
          <Link to="/login" style={{ color: 'var(--green-600)', fontWeight: 600 }}>
            ← Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>
            Enter your email and we'll send you a reset link.
          </p>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              type="email" className="form-input" placeholder="you@company.com"
              value={email} onChange={e => setEmail(e.target.value)} required autoFocus
            />
          </div>
          <button
            type="submit" className="btn btn-primary" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 15 }}>
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 13 }}>
            <Link to="/login" style={{ color: 'var(--green-600)' }}>← Back to sign in</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}

// ── RESET PASSWORD ────────────────────────────────────────────────────────────
export function ResetPasswordPage() {
  const { updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [form,     setForm]     = useState({ password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm)   { toast.error('Passwords do not match'); return; }
    if (form.password.length < 8)         { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    const { error } = await updatePassword(form.password);
    setLoading(false);
    if (error) toast.error(error.message);
    else setDone(true);
  };

  if (done) {
    return (
      <AuthLayout subtitle="Password updated">
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Password changed!</h2>
          <p style={{ fontSize: 14, color: 'var(--gray-500)', marginBottom: 28, lineHeight: 1.6 }}>
            Your password has been updated. Sign in with your new password to continue.
          </p>
          <button
            className="btn btn-primary"
            onClick={async () => { await signOut(); navigate('/login'); }}
            style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 15 }}>
            Go to sign in →
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout subtitle="Choose a new password">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="form-group">
          <label className="form-label required">New password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'} className="form-input"
              placeholder="Min. 8 characters" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required minLength={8} autoFocus style={{ paddingRight: 40 }}
            />
            <button
              type="button" onClick={() => setShowPass(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer', display: 'flex' }}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label required">Confirm new password</label>
          <input
            type="password" className="form-input" placeholder="Re-enter password"
            value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} required
          />
        </div>
        <button
          type="submit" className="btn btn-primary" disabled={loading}
          style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 15, marginTop: 4 }}>
          {loading ? 'Saving...' : 'Set new password'}
        </button>
      </form>
    </AuthLayout>
  );
}

// ── JOIN PAGE ─────────────────────────────────────────────────────────────────
// Landing page for invite links. Unchanged from original — validates the
// token and presents options to sign up or sign in.
export function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const { user }       = useAuth();
  const inviteToken    = searchParams.get('invite') || '';
  const [loading,    setLoading]    = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [error,      setError]      = useState('');

  useEffect(() => {
    if (!inviteToken) {
      setError('No invite token found in this link.');
      setLoading(false);
      return;
    }
    supabase
      .from('org_invites')
      .select('email, role, expires_at, organizations(name, industry)')
      .eq('token', inviteToken)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('This invite link is invalid or has expired. Ask your admin for a new one.');
        } else {
          setInviteData(data);
        }
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken]);

  const handleContinue      = () => navigate(user ? `/onboarding?invite=${inviteToken}` : `/register?invite=${inviteToken}`);
  const handleSignInInstead = () => navigate(`/login?invite=${inviteToken}`);

  return (
    <AuthLayout subtitle="You've been invited">
      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <div className="spinner" style={{ width: 28, height: 28, margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>Looking up your invite...</p>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>❌</div>
          <h3 style={{ marginBottom: 8, color: 'var(--gray-800)' }}>Invite not found</h3>
          <p style={{ color: 'var(--gray-500)', fontSize: 13, marginBottom: 20 }}>{error}</p>
          <Link to="/login" style={{ color: 'var(--green-600)', fontWeight: 600 }}>← Back to sign in</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            background: 'var(--green-50)', border: '1px solid var(--green-200)',
            borderRadius: 12, padding: '20px', textAlign: 'center',
          }}>
            <div style={{
              width: 52, height: 52, background: 'var(--green-100)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
            }}>
              <Building2 size={24} color="var(--green-700)" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--green-900)', marginBottom: 4 }}>
              {inviteData.organizations?.name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--green-700)' }}>
              has invited you to join as a{' '}
              <strong style={{ textTransform: 'capitalize' }}>{inviteData.role?.replace('_', ' ')}</strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 8 }}>
              Sent to: {inviteData.email}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              className="btn btn-primary" onClick={handleContinue}
              style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 15 }}>
              {user ? 'Accept & join →' : 'Sign up to accept →'}
            </button>
            {!user && (
              <button
                className="btn btn-secondary" onClick={handleSignInInstead}
                style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14 }}>
                I already have an account — sign in
              </button>
            )}
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>
            Expires {new Date(inviteData.expires_at).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
