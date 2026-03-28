# 🌿 Verdant CRM

A lightweight, fully multi-tenant CRM for small and growing businesses.
Built with React 18 + Supabase. Mobile responsive on every screen size.

> **Tagline:** Grow your pipeline. Close more deals.

---

## 📁 File Structure

```
verdant-crm/
├── public/
│   ├── favicon.svg                         ← Green leaf brand icon
│   ├── index.html                          ← Full SEO/OG/Twitter/JSON-LD meta
│   └── manifest.json                       ← PWA manifest
│
├── src/
│   ├── index.js                            ← React app entry point
│   ├── App.js                              ← Routes + auth gate + branded loader
│   │
│   ├── hooks/
│   │   └── usePageTitle.js                 ← Per-page document.title updates
│   │
│   ├── context/
│   │   └── AuthContext.js                  ← Auth state, profile, org, 15-day session, tab-switch safe
│   │
│   ├── lib/
│   │   └── supabase.js                     ← Supabase client initialisation
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   └── AuthPage.js                 ← Login, Register, ForgotPassword, JoinPage
│   │   ├── layout/
│   │   │   ├── Sidebar.js                  ← Dark green nav (slides in on mobile)
│   │   │   └── Header.js                   ← Top bar + hamburger + org name pill
│   │   ├── modules/
│   │   │   ├── EmailComposer.js            ← Compose + send + history per record
│   │   │   ├── NotesPanel.js               ← Notes on any record type
│   │   │   └── RecordDrawer.js             ← Slide-in detail panel (notes + email)
│   │   └── ui/
│   │       └── index.js                    ← Modal, Badge, FormGroup, Spinner…
│   │
│   ├── pages/
│   │   ├── LandingPage.js                  ← Public marketing page (hero, features, CTA)
│   │   ├── ContactPage.js                  ← Public contact / demo request form
│   │   ├── Onboarding.js                   ← First-time company setup wizard
│   │   ├── Dashboard.js                    ← KPI stats, real revenue chart
│   │   ├── Leads.js                        ← Lead management + one-click conversion
│   │   ├── Contacts.js                     ← Contact directory linked to accounts
│   │   ├── Accounts.js                     ← Company management
│   │   ├── Deals.js                        ← Kanban board + list + search
│   │   ├── Tasks.js                        ← To-dos with inline notes per task
│   │   ├── Activities.js                   ← All activity types incl. sent emails
│   │   ├── Products.js                     ← Product catalogue with pricing
│   │   ├── Quotes.js                       ← Sales quotes and proposals
│   │   ├── Campaigns.js                    ← Marketing campaign tracking
│   │   ├── Tickets.js                      ← Auto-numbered support tickets
│   │   ├── Invites.js                      ← Invite teammates by email + role
│   │   └── Settings.js                     ← Org, Pipeline, Custom fields, Users
│   │
│   └── styles/
│       └── global.css                      ← Design system, 31 media queries
│
├── supabase/
│   ├── functions/
│   │   ├── send-email/
│   │   │   └── index.ts                    ← CRM outbound email (Resend) + activity log
│   │   ├── send-invite/
│   │   │   └── index.ts                    ← Branded team invite email (Resend)
│   │   └── contact-form/
│   │       └── index.ts                    ← Website contact form → your inbox (Resend)
│   └── migrations/
│       ├── 001_initial_schema.sql          ← All 17 tables, enums, indexes, triggers
│       ├── 002_rls_policies.sql            ← Row-level security (public schema)
│       ├── 003_seed_data.sql               ← Default pipeline stages function
│       ├── 004_invites.sql                 ← Team invite table and policies
│       ├── 005_org_profile_fields.sql      ← Org address + contact fields
│       ├── 006_notes_index.sql             ← Composite index on notes
│       ├── 007_email_fields.sql            ← Email body/subject/status on activities
│       ├── 008_fix_rls_policies.sql        ← Fix missing INSERT/UPDATE RLS policies
│       ├── 009_fix_profile_select.sql      ← Fix user_profiles SELECT recursion
│       ├── 010_fix_crud_policies.sql       ← Complete role-based RLS rebuild for all tables
│       ├── 011_create_user_profile_trigger.sql ← Auto-create profile on auth signup
│       ├── 012_security_patch.sql          ← Security hardening
│       ├── 013_performance_indexes.sql     ← Additional query performance indexes
│       ├── 014_grant_permissions.sql       ← Explicit role grants
│       ├── 015_fix_user_profiles_rls_recursion.sql ← Fix RLS infinite recursion on user_profiles
│       ├── 016_fix_first_user_admin_trigger.sql    ← First user in org auto-promoted to admin
│       ├── 017_profile_on_login_not_signup.sql     ← Profile creation deferred to login
│       ├── 017b_restore_trigger.sql        ← Restore signup trigger after 017
│       └── 018_final_auth_fixes.sql        ← Final auth flow hardening
│
├── .env.example                            ← Copy to .env.local, fill in keys
├── .gitignore
├── vercel.json                             ← SPA routing rewrites + security headers
├── package.json
└── README.md
```

---

## ✨ Modules

| Module | Features | Notes | Email |
|--------|---------|-------|-------|
| **Dashboard** | KPI stats, real revenue chart (won deals), pipeline summary, tasks | — | — |
| **Leads** | Capture, qualify, convert → Contact + Account + Deal | ✅ | ✅ |
| **Contacts** | Directory linked to accounts | ✅ | ✅ |
| **Accounts** | Companies with address, billing, industry | ✅ | ✅ |
| **Deals** | Kanban board + list view, search + stage filter | ✅ | ✅ |
| **Tasks** | To-dos with priority, inline notes expand per task | ✅ | — |
| **Activities** | Log calls, emails, meetings, notes, demos | ✅ | — |
| **Products** | Catalogue with pricing, SKU, tax | ✅ | — |
| **Quotes** | Proposals with discounts | ✅ | — |
| **Campaigns** | Marketing tracking and ROI | ✅ | — |
| **Support Tickets** | Auto-numbered with priority and contact link | ✅ | ✅ |
| **Team Invites** | Direct email delivery to teammate — one click invite | — | — |
| **Settings** | Org profile, pipeline stages, custom fields, users & roles | — | — |

✅ Notes = click any record name to open the detail drawer with a notes panel
✅ Email = blue Email button in the drawer header → compose, send, view history

---

## 🏗️ Architecture

```
Frontend     : React 18 (Create React App)
Backend      : Supabase (PostgreSQL + Auth + Edge Functions + RLS)
Email        : Resend via Supabase Edge Functions
Deploy       : Vercel (frontend) + Supabase Cloud (backend)
Multi-tenant : every table has org_id; RLS enforces full data isolation
```

---

## 🔐 Session Behaviour

| Behaviour | Detail |
|-----------|--------|
| **Session length** | 15 days from first login — no re-login needed |
| **Tab switch** | Switching tabs and returning does NOT cause a loading screen. Supabase silently refreshes the JWT in the background. |
| **Token refresh** | Handled silently via `TOKEN_REFRESHED` event — profile is never re-fetched, only the JWT is updated |
| **Expiry** | After 15 days the session is cleared and the user is redirected to `/login` |
| **Explicit logout** | Clears session immediately — user must log in again |
| **Persistence** | Sessions survive page reloads and browser restarts via `localStorage` |

---

## 🗺️ What you need

| Service | Purpose | Cost |
|---------|---------|------|
| GitHub | Stores your code | Free |
| Supabase | Database + auth + edge functions | Free tier |
| Vercel | Hosts the live app | Free tier |
| Resend | Sends emails (optional but recommended) | Free: 100/day, 3k/month |

**Setup order: Supabase → GitHub → Vercel → (optional) Resend**

---

## 🌐 Routes

| URL | Who sees it | What it shows |
|-----|------------|---------------|
| `/` | Visitors → Landing page · Logged-in users with org → `/app` | Smart entry point |
| `/home` | Everyone | Marketing landing page (alias) |
| `/contact` | Everyone | Contact / demo request form |
| `/login` | Visitors and unconfirmed users | Login page |
| `/register` | Visitors and unconfirmed users | Sign up page |
| `/auth/callback` | Everyone | Email confirmation handler — redirects to `/onboarding` |
| `/join` | Visitors | Team invite acceptance preview |
| `/onboarding` | Logged-in users with no org yet | Company setup wizard |
| `/app` | Authenticated users with org | Dashboard |
| `/leads`, `/contacts`, etc. | Authenticated users with org | CRM modules |

---

# PART 1 — SUPABASE SETUP

## Step 1 — Create a Supabase account

Go to https://supabase.com → Sign up → you'll land on the dashboard.

## Step 2 — Create a new project

Click **New project** → fill in Name (`verdant-crm`), Database Password (save it somewhere safe), Region → **Create new project**. Wait ~2 minutes.

## Step 3 — Run all 19 SQL migrations (in order)

In your Supabase project → **SQL Editor** (left sidebar `</>` icon).

For each file: click **New query**, paste the full contents, click **Run**.
Wait for `Success. No rows returned` before moving to the next.

| # | File | What it does |
|---|------|-------------|
| 1 | `001_initial_schema.sql` | All 17 tables, enums, indexes, auto-timestamp triggers |
| 2 | `002_rls_policies.sql` | Row-level security — helper functions in `public` schema |
| 3 | `003_seed_data.sql` | Registers default pipeline stages function |
| 4 | `004_invites.sql` | Team invite table and policies |
| 5 | `005_org_profile_fields.sql` | Phone, email, address columns on organisations |
| 6 | `006_notes_index.sql` | Composite index for fast note lookups |
| 7 | `007_email_fields.sql` | Email body, subject, status columns on activities |
| 8 | `008_fix_rls_policies.sql` | Fix missing INSERT policies for onboarding |
| 9 | `009_fix_profile_select.sql` | Fix user_profiles SELECT to unblock login |
| 10 | `010_fix_crud_policies.sql` | Complete role-based RLS rebuild for all tables |
| 11 | `011_create_user_profile_trigger.sql` | Auto-create user_profiles row on auth.users insert |
| 12 | `012_security_patch.sql` | Security hardening patches |
| 13 | `013_performance_indexes.sql` | Additional performance indexes for common queries |
| 14 | `014_grant_permissions.sql` | Explicit grants for anon and authenticated roles |
| 15 | `015_fix_user_profiles_rls_recursion.sql` | Fix infinite recursion in user_profiles RLS |
| 16 | `016_fix_first_user_admin_trigger.sql` | First user in an org is auto-promoted to admin |
| 17 | `017_profile_on_login_not_signup.sql` | Defers profile creation to first login |
| 18 | `017b_restore_trigger.sql` | Restores signup trigger adjusted by migration 017 |
| 19 | `018_final_auth_fixes.sql` | Final auth flow hardening and edge case fixes |

All 19 must show `Success` before continuing.

## Step 4 — Get your API keys

Settings (gear icon, bottom left) → **API** → copy:
- **Project URL** → `https://xxxxxxxxxxx.supabase.co`
- **anon / public key** → long string starting with `eyJ`

## Step 5 — Configure Auth redirect URLs

Authentication → **URL Configuration** → set:

| Field | Value |
|-------|-------|
| Site URL | `http://localhost:3000` (update to Vercel URL after deploy) |
| Redirect URLs | `http://localhost:3000/**` |

Click **Save**.

---

# PART 2 — GITHUB

## Step 6 — Create a GitHub repository

https://github.com → **+** → **New repository** → name it `verdant-crm` → Private → **Create repository**.
Do NOT tick "Add a README" or ".gitignore" — you already have them.

## Step 7 — Upload your code

### Option A — GitHub Desktop (easiest, no command line)
1. Download from https://desktop.github.com
2. File → Add Local Repository → browse to your `verdant-crm` folder
3. Commit message: `Initial commit` → Commit to main → Publish repository

### Option B — Terminal
```bash
cd ~/Desktop/verdant-crm   # or wherever you extracted the zip
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/verdant-crm.git
git branch -M main
git push -u origin main
```

---

# PART 3 — VERCEL DEPLOYMENT

## Step 8 — Create a Vercel account

https://vercel.com → **Sign Up** → **Continue with GitHub** → Authorize.

## Step 9 — Deploy

Vercel dashboard → **Add New** → **Project** → find `verdant-crm` → **Import**.
Framework auto-detects as **Create React App** — leave it.

Add 4 environment variables:

| Variable | Value |
|----------|-------|
| `REACT_APP_SUPABASE_URL` | Your Supabase Project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `REACT_APP_NAME` | `Verdant CRM` |
| `REACT_APP_URL` | Leave blank for now |

Click **Deploy** → wait ~3 minutes → copy your Vercel URL (e.g. `https://verdant-crm.vercel.app`).

## Step 10 — Update REACT_APP_URL

Vercel → your project → **Settings** → **Environment Variables** → edit `REACT_APP_URL` → paste your Vercel URL → Save.

Deployments → three dots on latest → **Redeploy**.

## Step 11 — Update Supabase Auth redirect URLs

Supabase → Authentication → **URL Configuration**:

| Field | Value |
|-------|-------|
| Site URL | `https://verdant-crm.vercel.app` |
| Redirect URLs | `https://verdant-crm.vercel.app/**` |

Save.

## ✅ Your CRM is live!

---

# HOW THE USER FLOWS WORK

## Flow A — First person sets up a company (admin)

```
/register → fill in name, email, password → Create account
→ Email confirmation screen shown — check your inbox
→ Click the confirmation link in the email → /auth/callback → /onboarding
→ "Set up my company" → fill name, industry, currency, timezone
→ Dashboard opens — you are admin, pipeline stages seeded automatically
→ Settings → Organisation to add/edit company details any time
```

## Flow B — Teammate joins an existing company

This is a **4-step process**. The teammate always has to create their own account.

**Admin (Step 1):** Sidebar → Team Invites → Invite Teammate → enter colleague's email + role → **Send Invite** → the invite email is delivered directly to their inbox (no copy-pasting required)

**Teammate (Step 2):** Clicks the link in their email → lands on `/join?invite=TOKEN` → sees company name and assigned role → clicks **"Sign up to accept →"**

**Teammate (Step 3):** Arrives at `/register?invite=TOKEN` → email is pre-filled and locked (must match the invite) → fills in name and password → Create account & join → confirms email

**Teammate (Step 4):** Goes to `/login` → signs in → app detects invite token → automatically added to the company with assigned role → Dashboard opens

**Rules:**
- Teammate MUST sign up with the exact email the invite was sent to
- Invites expire after 7 days — create a new one if it expires
- Admins and managers can create invites; only admins can change roles later

## User Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full access — all records + settings, pipeline, custom fields, users, invites |
| `manager` | Create + view + edit/delete all records in the org |
| `sales_rep` | Create + view all records + edit/delete own records or unassigned records |
| `viewer` | Read-only access to all records — no create, edit, or delete |

**Note:** Every new signup gets `sales_rep` as a temporary default. This is overwritten immediately during onboarding — company creators become `admin`, invited teammates get the role their admin assigned.

---

# NOTES — HOW THEY WORK

Notes let you log conversations, decisions, and context on any record.

## Where notes are available

| Page | How to open notes |
|------|-----------------|
| Leads | Click lead name (dotted underline) → detail drawer → notes at bottom |
| Contacts | Click contact name → drawer |
| Accounts | Click account name → drawer |
| Deals | Click deal name in list, or click any Kanban card → drawer |
| Tasks | Click the 📄 icon on any task row → inline panel expands below |
| Activities | Click activity subject → drawer |
| Products | Click product name → drawer |
| Quotes | Click quote title → drawer |
| Campaigns | Click campaign name → drawer |
| Tickets | Click ticket subject → drawer |

## Adding a note
1. Open the record drawer (or task expand panel)
2. Scroll to the **Notes** section
3. Click **Add Note** → write title (optional) and content → **Save Note**

Notes show author initials avatar, name, and relative timestamp ("2h ago", "3d ago").
Only the author can edit or delete their own notes.

## Notes on Lead Conversion

When you click **Convert** on a lead, all notes on that lead are **automatically copied** to every record created during conversion (Contact, Account, Deal). The originals stay on the lead — they are copied, not moved.

---

# LEAD CONVERSION

The **Convert** button appears on every non-converted lead in the table.

The conversion modal has 3 toggleable sections:

1. **Create Contact** — pre-filled from lead data; toggle off if contact already exists
2. **Create Account** — pre-filled from lead's company; can link to an existing account instead
3. **Create Deal** — off by default; set name, stage, amount, close date

On clicking **Convert Lead**:
- Records created in order (Account → Contact → Deal) so relationships link correctly
- All notes copied to all created records
- Lead marked `Converted` with a ✅ badge and can no longer be converted again

---

# SENDING EMAILS FROM THE CRM

Send emails to leads, contacts, accounts, deals, and tickets directly from within the CRM. All sent emails are automatically recorded as Activities.

## How to send an email

1. Open any record drawer (click a record name on Leads, Contacts, Accounts, Deals, or Tickets)
2. Click the blue **Email** button in the drawer header
3. The email composer slides up from the bottom of the screen
4. Fill in Subject and Body (or choose a template), then click **Send**

The email sends via Resend and is logged as an Activity on that record immediately.

## Email templates (6 built-in)

Pick a template from the **Templates** button inside the composer:
- **Introduction** — first contact with a new lead
- **Follow-up** — chasing a previous conversation
- **Proposal sent** — after sending a quote
- **Meeting confirmation** — confirming a scheduled meeting
- **Thank you** — after a meeting or call
- **Check-in** — general relationship touch

Variables `{{first_name}}`, `{{sender_name}}`, and `{{org_name}}` are replaced automatically.

## Viewing sent email history

Inside the composer, click the **History** tab to see all emails sent to that specific record — each expandable to show the full body.

You can also see all sent emails on the **Activities** page. Filter by **type = Email** to see only emails. Each row shows: subject, recipient address, body preview, and a "sent" status badge. Click the subject to open the detail drawer with the full To, CC, subject, and message body.

## Email traceability — what gets recorded

Every sent email saves to the `activities` table with:
- `type = 'email'`
- `email_to` — recipient address
- `email_subject` — subject line
- `email_body_text` — full plain-text body
- `email_status = 'sent'`
- `email_message_id` — Resend's message ID
- `related_to_type` + `related_to_id` — links back to the exact CRM record

## Setup required — Resend API (one time)

**Step 1 — Create a free Resend account**
Go to https://resend.com → sign up → verify your sending domain (or use `onboarding@resend.dev` to test first) → API Keys → Create API Key → copy it.

**Step 2 — Deploy all three Edge Functions**
```bash
# Install Supabase CLI (one time): npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy send-email
supabase functions deploy send-invite
supabase functions deploy contact-form
```
Your project ref is the part of your Supabase URL between `https://` and `.supabase.co`.

**Step 3 — Set secrets in Supabase**
Supabase dashboard → Edge Functions → each function → Secrets → add:

| Secret | Used by | Value |
|--------|---------|-------|
| `RESEND_API_KEY` | All three functions | Your Resend API key (starts with `re_`) |
| `FROM_EMAIL` | All three functions | Your verified sender e.g. `crm@yourcompany.com` |
| `FROM_NAME` | All three functions | Display name e.g. `Acme CRM` |
| `CONTACT_INBOX` | `contact-form` only | **Your personal email** where contact form submissions arrive |

**Step 4 — Confirm migration 007 was run**
Make sure `supabase/migrations/007_email_fields.sql` was run in the SQL Editor (Step 3 of the initial setup). If you skipped it, run it now.

Done — the Email button will appear in all record drawers.

---

# CONTACT FORM — WHERE INQUIRIES ARE DELIVERED

When a visitor fills in the contact form on your website (`/contact`), the message is emailed directly to your inbox via the `contact-form` Edge Function.

## What the email looks like

- **Subject:** `🎯 Demo Request from Jane Smith (Acme Inc.)`
- **From:** your verified Resend sender (e.g. `crm@yourcompany.com`)
- **Reply-To:** the visitor's email address — so you just hit **Reply** to respond

The email shows: inquiry type, name, email, company, role, and full message, plus a green **"Reply to Jane →"** button.

## Setup

Deploy the `contact-form` function and add the `CONTACT_INBOX` secret (see Email Setup Step 2–3 above). The other three secrets (`RESEND_API_KEY`, `FROM_EMAIL`, `FROM_NAME`) are shared — if you've already deployed `send-email`, they're already set.

If Resend is not yet deployed, the form still shows visitors a success message and logs a console warning for you.

---

# DEPLOYING UPDATES

Any time you edit code:
```bash
git add .
git commit -m "describe the change"
git push
```
Vercel detects the push and redeploys in ~2 minutes. No manual steps needed.

---

# CUSTOMISING YOUR CRM

**Company profile**
Settings → Organisation → edit name, address, phone, website, industry, timezone, currency → Save

**Pipeline stages**
Settings → Pipeline → add, rename, reorder, set probability % and colour, mark Won/Lost

**Custom fields**
Settings → Custom Fields → pick a module → Add Field
Types: text, number, select, multiselect, date, datetime, email, phone, URL, currency, percent, boolean

**Change brand colour**
In `src/styles/global.css`:
```css
--green-600: #16a34a;   /* primary buttons, active states */
--green-700: #15803d;   /* hover states */
```
Replace with any hex colour → `git push` → Vercel rebuilds automatically.

---

# LOCAL DEVELOPMENT (optional)

Requires Node.js 18+ from https://nodejs.org

```bash
npm install
cp .env.example .env.local
# Open .env.local and paste your Supabase URL and anon key
npm start
# Opens http://localhost:3000
```

When running locally, Supabase Auth → URL Configuration must have:
- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/**`

---

# MOBILE RESPONSIVENESS

| Screen size | Layout |
|------------|--------|
| ≥ 1024px (desktop) | Full sidebar (240px), all table columns visible, 2-col charts |
| 768–1023px (tablet) | Sidebar narrows to 200px, all columns still visible |
| ≤ 767px (mobile) | Sidebar hidden behind hamburger button, full-width layout, secondary columns hidden |
| ≤ 600px (small mobile) | Modals slide up as bottom sheets, filter bars stack, forms collapse to 1 column |
| ≤ 480px (very small) | Auth/onboarding cards slide up from bottom, 2-column stat grid |

Key mobile features:
- **Kanban board** — horizontal scroll with touch momentum and column snap
- **Record drawer** — `min(480px, 100vw)` — full-width on phones, slides in from right
- **Email composer** — `min(560px, 100vw)` — full-width on phones, slides up from bottom
- **iOS zoom prevention** — `font-size: max(16px, 14px)` on all inputs
- **Tap targets** — buttons min 36px height, inputs min 38px height
- **Momentum scrolling** — `-webkit-overflow-scrolling: touch` on all scrollable areas
- **31 CSS media queries** covering 6 breakpoints (480, 600, 767, 768, 900, 1023px)

---

# TROUBLESHOOTING

**"Missing Supabase credentials" in browser console**
→ `.env.local` values are missing or wrong. Re-copy from Supabase → Settings → API. No spaces around `=`.

**Spinner on login never goes away**
→ If it lasts more than 8 seconds a "Try again" button appears. Click it. If it keeps happening, check your Supabase URL and anon key in `.env.local`.

**After switching tabs, the app shows a loading spinner forever**
→ This was a known bug, fixed in `AuthContext.js`. Replace your file with the latest version. The fix ensures `TOKEN_REFRESHED` events (which fire on tab focus) never trigger a profile re-fetch or loading state.

**After login, redirected to /onboarding every time**
→ Correct for new users with no company. Follow Flow A above.

**Invite link says "invalid or expired"**
→ Invites expire after 7 days. Admin creates a new one. Teammate must sign up with the exact email the invite was sent to.

**Email button not appearing in drawers**
→ The record has no email address stored. Add an email to the record and the button will appear.

**Email sending fails with "RESEND_API_KEY not configured"**
→ Complete the Email Setup steps above. Make sure all three edge functions are deployed and secrets are set.

**Invite email not received by teammate**
→ Check spam folder. If Resend is not configured, the invite is still created — use the **Copy link** button as a fallback.

**Email sends but doesn't appear in Activities**
→ Make sure migration 007 was run. Check Supabase Edge Functions logs for errors.

**Notes not appearing after lead conversion**
→ Make sure migration 006 was run. If the lead had no notes, nothing is copied — that is correct behaviour.

**"new row violates row-level security policy" on onboarding or any module**
→ Run `supabase/migrations/010_fix_crud_policies.sql` in Supabase SQL Editor. This rebuilds all RLS policies with direct subqueries instead of helper functions, fixing all UPDATE and DELETE operations.

**SQL error on any migration**
→ Migrations must run in order: 001 through 018. Each depends on the previous.

**Vercel build fails with ESLint errors**
→ All 4 `REACT_APP_*` environment variables must be set. Names are case-sensitive.

**Can't see `.env.example` in Finder / Explorer**
→ Dot-files are hidden. Mac: `Cmd+Shift+.` in Finder. Windows: File Explorer → View → Hidden items.

**After deploy, email confirmation link redirects to wrong page**
→ Update Supabase Auth → URL Configuration with your Vercel URL (Step 11).

---

# ENVIRONMENT VARIABLES REFERENCE

| Variable | Where to find it | Required |
|----------|-----------------|----------|
| `REACT_APP_SUPABASE_URL` | Supabase → Settings → API → Project URL | ✅ |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key | ✅ |
| `REACT_APP_NAME` | Any display name for the app | Optional |
| `REACT_APP_URL` | Your Vercel deployment URL | ✅ |

---

*Verdant CRM — React 18 + Supabase + Vercel*
*Grow your pipeline. Close more deals.*
