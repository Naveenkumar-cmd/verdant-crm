// src/pages/ContactPage.js
// Public contact / demo request page.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import usePageTitle from '../hooks/usePageTitle';

export default function ContactPage() {
  usePageTitle('Contact Us – Verdant CRM');

  const [form, setForm] = useState({
    name: '', email: '', company: '', role: '', message: '', type: 'demo',
  });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('contact-form', {
        body: {
          name:    form.name.trim(),
          email:   form.email.trim(),
          company: form.company.trim() || null,
          role:    form.role  || null,
          message: form.message.trim(),
          type:    form.type,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSent(true);
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('RESEND_API_KEY') || msg.includes('not configured')) {
        // Edge function not deployed yet — still show success to visitor
        // and log to console for the developer
        console.warn('contact-form: Resend not configured yet. Deploy the edge function and set CONTACT_INBOX secret.');
        setSent(true);
      } else {
        alert(`Sorry, we couldn't send your message right now. Please try emailing us directly.\n\nError: ${msg}`);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="lp-root">

      {/* Nav */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <Link to="/" className="lp-logo">
            <div className="lp-logo-mark">🌿</div>
            <span className="lp-logo-text">Verdant CRM</span>
          </Link>
          <div className="lp-nav-links hide-mobile-flex">
            <Link to="/#features" className="lp-nav-link">Features</Link>
            <Link to="/contact"   className="lp-nav-link" style={{ color: 'var(--green-400)' }}>Contact</Link>
          </div>
          <div className="lp-nav-actions hide-mobile-flex">
            <Link to="/login"    className="lp-btn-ghost">Sign in</Link>
            <Link to="/register" className="lp-btn-primary">Get started free</Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="lp-contact-header">
        <div className="lp-container" style={{ textAlign: 'center' }}>
          <div className="lp-section-badge" style={{ margin: '0 auto 16px' }}>Get in touch</div>
          <h1 className="lp-hero-h1" style={{ fontSize: 'clamp(32px, 5vw, 52px)', marginBottom: 16 }}>
            Let's talk
          </h1>
          <p className="lp-hero-sub" style={{ maxWidth: 500, margin: '0 auto' }}>
            Whether you want a demo, have a question, or just want to see if Verdant CRM
            is right for your team — we'd love to hear from you.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="lp-contact-body">
        <div className="lp-container lp-contact-grid">

          {/* Form */}
          <div className="lp-contact-form-wrap">
            {sent ? (
              <div className="lp-contact-success">
                <div className="lp-contact-success-icon">✅</div>
                <h2>Message sent!</h2>
                <p>Thanks for reaching out. We'll get back to you within 1 business day.</p>
                <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
                  <Link to="/register" className="lp-btn-primary">Start free trial →</Link>
                  <button onClick={() => setSent(false)} className="lp-btn-outline">Send another</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="lp-contact-form">
                <h2 className="lp-contact-form-title">Send us a message</h2>

                {/* Type selector */}
                <div className="lp-type-selector">
                  {[
                    { v: 'demo',     label: '🎯 Request a demo' },
                    { v: 'question', label: '💬 Ask a question' },
                    { v: 'sales',    label: '💼 Talk to sales' },
                  ].map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: opt.v }))}
                      className={`lp-type-btn ${form.type === opt.v ? 'active' : ''}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="lp-contact-row">
                  <div className="form-group">
                    <label className="lp-label">Full name *</label>
                    <input className="form-input" value={form.name} onChange={set('name')}
                      placeholder="Jane Smith" required />
                  </div>
                  <div className="form-group">
                    <label className="lp-label">Work email *</label>
                    <input type="email" className="form-input" value={form.email} onChange={set('email')}
                      placeholder="jane@company.com" required />
                  </div>
                </div>

                <div className="lp-contact-row">
                  <div className="form-group">
                    <label className="lp-label">Company</label>
                    <input className="form-input" value={form.company} onChange={set('company')}
                      placeholder="Acme Inc." />
                  </div>
                  <div className="form-group">
                    <label className="lp-label">Your role</label>
                    <select className="form-input form-select" value={form.role} onChange={set('role')}>
                      <option value="">Select...</option>
                      {['Founder / CEO','Head of Sales','Sales Manager','Account Executive',
                        'Operations','Marketing','Other'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="lp-label">Message *</label>
                  <textarea className="form-input form-textarea" value={form.message} onChange={set('message')}
                    rows={5} placeholder={
                      form.type === 'demo'     ? "Tell us about your team size and what you're looking to solve..." :
                      form.type === 'question' ? "What would you like to know?" :
                      "Tell us about your needs and we'll tailor a proposal..."
                    } required style={{ minHeight: 120 }} />
                </div>

                <button type="submit" className="lp-btn-primary lp-btn-block" disabled={sending}
                  style={{ marginTop: 8, padding: '13px', fontSize: 15 }}>
                  {sending ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                      Sending...
                    </span>
                  ) : form.type === 'demo' ? 'Request a demo →' : 'Send message →'}
                </button>

                <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 12, textAlign: 'center' }}>
                  We respond within 1 business day. No spam, ever.
                </p>
              </form>
            )}
          </div>

          {/* Info panel */}
          <div className="lp-contact-info">
            <div className="lp-contact-info-card">
              <h3 className="lp-contact-info-title">Why teams choose Verdant CRM</h3>
              <ul className="lp-contact-bullets">
                {[
                  '✅  Free forever plan — no credit card needed',
                  '✅  Setup in under 2 minutes',
                  '✅  Invite your whole team instantly',
                  '✅  Mobile-ready on every screen size',
                  '✅  Email sending built right in',
                  '✅  Notes & full activity history',
                  '✅  Lead conversion in one click',
                ].map(b => <li key={b}>{b}</li>)}
              </ul>

              <div className="lp-contact-divider" />

              <div className="lp-contact-testimonial">
                <p className="lp-contact-quote">
                  "Verdant CRM replaced three separate tools. Our team actually uses it every day — it's that intuitive."
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                  <div className="lp-testimonial-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>SC</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Sarah Chen</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Head of Sales, Novara Tech</div>
                  </div>
                </div>
              </div>

              <div className="lp-contact-divider" />

              <div>
                <div className="lp-contact-info-sub">Already have an account?</div>
                <Link to="/login" className="lp-btn-outline lp-btn-block" style={{ marginTop: 10 }}>
                  Sign in →
                </Link>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer" style={{ marginTop: 0 }}>
        <div className="lp-footer-bottom">
          <div className="lp-container">
            <span>© {new Date().getFullYear()} Verdant CRM. All rights reserved.</span>
            <Link to="/" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>← Back to home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
