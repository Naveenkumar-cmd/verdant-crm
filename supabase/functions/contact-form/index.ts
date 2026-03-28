// supabase/functions/contact-form/index.ts
//
// Receives public contact / demo-request form submissions and emails
// them to the business owner's inbox via Resend.
//
// Deploy:
//   supabase functions deploy contact-form
//
// Secrets required (same as send-email):
//   RESEND_API_KEY      — your Resend API key
//   FROM_EMAIL          — verified sender address e.g. crm@yourcompany.com
//   FROM_NAME           — sender display name
//   CONTACT_INBOX       — the email address where you want to RECEIVE inquiries
//                         e.g. hello@yourcompany.com or your personal email
//                         If not set, falls back to FROM_EMAIL

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      name,       // visitor's full name
      email,      // visitor's email — set as reply_to so you can just hit Reply
      company,    // optional
      role,       // optional
      message,    // the inquiry message
      type,       // 'demo' | 'question' | 'sales'
    } = await req.json();

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'name, email, and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const FROM_EMAIL     = Deno.env.get('FROM_EMAIL')    || 'noreply@verdantcrm.app';
    const FROM_NAME      = Deno.env.get('FROM_NAME')     || 'Verdant CRM';
    const CONTACT_INBOX  = Deno.env.get('CONTACT_INBOX') || FROM_EMAIL; // where YOU receive it

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const typeLabel = type === 'demo'     ? '🎯 Demo Request'
                    : type === 'sales'    ? '💼 Sales Inquiry'
                    : type === 'question' ? '💬 Question'
                    : '📩 Contact Form';

    const subject = `${typeLabel} from ${name}${company ? ` (${company})` : ''}`;

    // ── Plain text ─────────────────────────────────────────────
    const bodyText = `
New contact form submission from your Verdant CRM website.

Type:     ${typeLabel}
Name:     ${name}
Email:    ${email}
Company:  ${company || '—'}
Role:     ${role    || '—'}

Message:
${message}

──
Reply directly to this email to respond to ${name}.
Sent from Verdant CRM contact form.
`.trim();

    // ── HTML ───────────────────────────────────────────────────
    const bodyHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f8faf9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faf9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:24px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#16a34a;border-radius:10px;width:38px;height:38px;text-align:center;vertical-align:middle;">
              <span style="color:white;font-size:20px;line-height:38px;">🌿</span>
            </td>
            <td style="padding-left:9px;vertical-align:middle;">
              <span style="font-size:17px;font-weight:700;color:#166534;">Verdant CRM</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:white;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">

          <!-- Header -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:linear-gradient(135deg,#14532d 0%,#16a34a 100%);padding:28px 32px;">
              <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.08em;">New Inquiry</p>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:white;">${typeLabel}</h1>
            </td></tr>
          </table>

          <!-- Body -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:32px;">

              <!-- Sender info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:10px;margin-bottom:24px;">
                <tr><td style="padding:20px;">
                  ${[
                    ['Name',    name],
                    ['Email',   `<a href="mailto:${email}" style="color:#16a34a;">${email}</a>`],
                    ['Company', company || '—'],
                    ['Role',    role    || '—'],
                  ].map(([label, value]) => `
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                    <tr>
                      <td style="width:80px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;vertical-align:top;padding-top:1px;">${label}</td>
                      <td style="font-size:14px;color:#1f2937;">${value}</td>
                    </tr>
                  </table>`).join('')}
                </td></tr>
              </table>

              <!-- Message -->
              <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Message</p>
              <div style="background:#f9fafb;border-left:3px solid #16a34a;border-radius:0 8px 8px 0;padding:16px 20px;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr><td style="background:#16a34a;border-radius:9px;text-align:center;">
                  <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject)}"
                     style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:700;color:white;text-decoration:none;">
                    Reply to ${name} →
                  </a>
                </td></tr>
              </table>

              <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
                Sent from your Verdant CRM contact form. Reply directly to respond.
              </p>

            </td></tr>
          </table>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // ── Send via Resend ─────────────────────────────────────────
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:     `${FROM_NAME} <${FROM_EMAIL}>`,
        to:       [CONTACT_INBOX],          // → YOUR inbox
        reply_to: email,                    // → visitor's email (so Reply goes to them)
        subject,
        text: bodyText,
        html: bodyHtml,
      }),
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) {
      console.error('Resend error:', resendData);
      return new Response(
        JSON.stringify({ error: resendData.message || 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('contact-form error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
