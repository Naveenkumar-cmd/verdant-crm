// supabase/functions/send-email/index.ts
//
// Supabase Edge Function — sends an email via Resend and logs it
// as an 'email' activity in the activities table.
//
// Deploy with:
//   supabase functions deploy send-email
//
// Environment variables required (set in Supabase Dashboard → Functions → Secrets):
//   RESEND_API_KEY      — your Resend API key (re_...)
//   FROM_EMAIL          — verified sender address e.g. crm@yourcompany.com
//   FROM_NAME           — sender display name  e.g. "Acme CRM"
//
// Called from the React app via supabase.functions.invoke('send-email', { body: {...} })

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      to,              // string  — recipient email address
      cc,              // string  — optional CC addresses (comma-separated)
      subject,         // string  — email subject line
      body_text,       // string  — plain text body
      body_html,       // string  — HTML body
      related_to_type, // string  — 'lead' | 'contact' | 'account' | 'deal'
      related_to_id,   // string  — UUID of the related record
      org_id,          // string  — the organisation UUID
      sent_by_id,      // string  — user_profile UUID of the sender
      sender_name,     // string  — display name of the sender
      sender_email,    // string  — sender's CRM email (for reference)
    } = await req.json();

    // Validate required fields
    if (!to || !subject || !body_text) {
      return new Response(JSON.stringify({ error: 'to, subject, and body_text are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') || 'crm@verdantcrm.app';
    const FROM_NAME      = Deno.env.get('FROM_NAME')  || 'Verdant CRM';

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured. Set it in Supabase → Functions → Secrets.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Send via Resend ──────────────────────────────────────
    const resendPayload: Record<string, unknown> = {
      from:    `${FROM_NAME} <${FROM_EMAIL}>`,
      to:      [to.trim()],
      subject: subject.trim(),
      text:    body_text,
      html:    body_html || `<div style="font-family:sans-serif;line-height:1.6">${body_text.replace(/\n/g,'<br>')}</div>`,
      reply_to: sender_email || undefined,
    };

    if (cc?.trim()) {
      resendPayload.cc = cc.split(',').map((e: string) => e.trim()).filter(Boolean);
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error('Resend error:', resendData);
      return new Response(JSON.stringify({ error: resendData.message || 'Email sending failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Log as activity in the database ─────────────────────
    // Use service role client so we can write regardless of RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { error: activityError } = await supabaseAdmin.from('activities').insert({
      org_id,
      type:             'email',
      subject:          subject.trim(),
      email_subject:    subject.trim(),
      email_to:         to.trim(),
      email_from:       `${sender_name || FROM_NAME} <${FROM_EMAIL}>`,
      email_cc:         cc?.trim() || null,
      email_body_text:  body_text,
      email_body_html:  body_html || null,
      email_status:     'sent',
      email_message_id: resendData.id || null,
      related_to_type:  related_to_type || null,
      related_to_id:    related_to_id   || null,
      activity_date:    new Date().toISOString(),
      created_by:       sent_by_id || null,
      owner_id:         sent_by_id || null,
      description:      `Email sent to ${to}`,
      outcome:          'sent',
    });

    if (activityError) {
      console.error('Activity log error:', activityError);
      // Still return success — email was sent even if logging failed
      return new Response(JSON.stringify({
        success: true,
        message_id: resendData.id,
        warning: 'Email sent but activity log failed: ' + activityError.message,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, message_id: resendData.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
