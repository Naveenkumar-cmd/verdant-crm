// supabase/functions/send-invite/index.ts
//
// Sends a team invite email via Resend.
// Called from the React app when an admin invites a teammate.
//
// Deploy with:
//   supabase functions deploy send-invite
//
// Environment variables (same as send-email function):
//   RESEND_API_KEY  — your Resend API key
//   FROM_EMAIL      — verified sender address
//   FROM_NAME       — sender display name
//
// Payload:
//   invite_email    — recipient's email address
//   invite_token    — the invite token (UUID hex string)
//   invite_role     — role being assigned
//   org_name        — name of the organisation
//   sender_name     — full name of the person sending the invite
//   app_url         — base URL of the app (e.g. https://verdant-crm.vercel.app)

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
      invite_email,
      invite_token,
      invite_role,
      org_name,
      sender_name,
      app_url,
    } = await req.json();

    if (!invite_email || !invite_token || !org_name) {
      return new Response(
        JSON.stringify({ error: 'invite_email, invite_token and org_name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') || 'noreply@verdantcrm.app';
    const FROM_NAME      = Deno.env.get('FROM_NAME')  || 'Verdant CRM';

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured. Set it in Supabase → Functions → Secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl   = (app_url || 'https://verdantcrm.app').replace(/\/$/, '');
    const joinUrl   = `${baseUrl}/join?invite=${invite_token}`;
    const roleName  = (invite_role || 'member').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const from      = sender_name || 'Your team';

    // ── Plain text ──────────────────────────────────────────
    const bodyText = `You've been invited to join ${org_name} on Verdant CRM

${from} has invited you to join ${org_name} as a ${roleName}.

Click the link below to accept your invite and set up your account:

${joinUrl}

This invite expires in 7 days.

If you weren't expecting this invite, you can safely ignore this email.

—
Verdant CRM · Grow your pipeline. Close more deals.
`;

    // ── HTML ────────────────────────────────────────────────
    const bodyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to ${org_name}</title>
</head>
<body style="margin:0;padding:0;background:#f8faf9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faf9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#16a34a;border-radius:12px;width:44px;height:44px;text-align:center;vertical-align:middle;">
                    <span style="color:white;font-size:22px;line-height:44px;">🌿</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:20px;font-weight:700;color:#166534;">Verdant CRM</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:white;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">

              <!-- Green header -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#14532d 0%,#15803d 50%,#16a34a 100%);padding:32px 36px;text-align:center;">
                    <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:0.08em;">You've been invited</p>
                    <h1 style="margin:0;font-size:26px;font-weight:700;color:white;line-height:1.2;">Join ${org_name}</h1>
                  </td>
                </tr>
              </table>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:36px;">

                    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
                      <strong>${from}</strong> has invited you to join
                      <strong>${org_name}</strong> on Verdant CRM as a
                      <strong style="color:#16a34a;">${roleName}</strong>.
                    </p>

                    <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">
                      Click the button below to accept your invite. You'll create your account
                      using this email address and be added to the workspace automatically.
                    </p>

                    <!-- CTA Button -->
                    <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                      <tr>
                        <td style="background:#16a34a;border-radius:10px;text-align:center;">
                          <a href="${joinUrl}"
                             style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:white;text-decoration:none;letter-spacing:0.01em;">
                            Accept Invite →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Fallback link -->
                    <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-align:center;">
                      Button not working? Copy and paste this link:
                    </p>
                    <p style="margin:0 0 28px;font-size:11px;color:#6b7280;text-align:center;word-break:break-all;">
                      <a href="${joinUrl}" style="color:#16a34a;">${joinUrl}</a>
                    </p>

                    <!-- Divider -->
                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;" />

                    <!-- Expiry notice -->
                    <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                      This invite expires in <strong>7 days</strong>.<br />
                      If you weren't expecting this, you can safely ignore it.
                    </p>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Verdant CRM · Grow your pipeline. Close more deals.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // ── Send via Resend ─────────────────────────────────────
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    `${FROM_NAME} <${FROM_EMAIL}>`,
        to:      [invite_email.trim()],
        subject: `${from} invited you to join ${org_name} on Verdant CRM`,
        text:    bodyText,
        html:    bodyHtml,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error('Resend error:', resendData);
      return new Response(
        JSON.stringify({ error: resendData.message || 'Failed to send invite email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message_id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('send-invite error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
