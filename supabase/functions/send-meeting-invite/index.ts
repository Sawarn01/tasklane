import { createClient } from 'jsr:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@^6.9'

// ── SMTP config (set these in Supabase Dashboard → Project Settings → Edge Functions → Secrets)
// SMTP_HOST  — e.g. smtp.gmail.com  |  smtp.office365.com  |  smtp.zoho.com
// SMTP_PORT  — 587 (STARTTLS, recommended) or 465 (SSL)
// SMTP_USER  — your full email address
// SMTP_PASS  — app password (Gmail: myaccount.google.com/apppasswords)
// SMTP_FROM  — display name + address, e.g. "Tasklane Meetings <you@gmail.com>"
// APP_URL    — your deployed app URL, e.g. https://tasklane.app

const SMTP_HOST  = Deno.env.get('SMTP_HOST')!
const SMTP_PORT  = Number(Deno.env.get('SMTP_PORT') || '587')
const SMTP_USER  = Deno.env.get('SMTP_USER')!
const SMTP_PASS  = Deno.env.get('SMTP_PASS')!
const SMTP_FROM  = Deno.env.get('SMTP_FROM') || `Tasklane Meetings <${SMTP_USER}>`
const APP_URL    = Deno.env.get('APP_URL') || 'https://tasklane.app'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function pad2(n: number) { return String(n).padStart(2, '0') }

function formatTime(t: string | null | undefined) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour  = h % 12 || 12
  return `${hour}:${pad2(m)} ${ampm}`
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function buildHtml({
  title, date, time, agenda, meeting_url, host_name, project_name,
}: {
  title: string; date: string; time?: string; agenda?: string;
  meeting_url?: string; host_name: string; project_name: string;
}) {
  const joinButton = meeting_url
    ? `<a href="${meeting_url}" style="display:inline-block;padding:12px 28px;background:#6E56CF;color:#fff;border-radius:10px;font-weight:600;text-decoration:none;font-size:14px;margin-top:8px;">Join Meeting</a>`
    : ''

  const agendaBlock = agenda
    ? `<div style="margin-top:20px;padding:16px;background:#F1EFE7;border-radius:10px;">
        <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:.08em;color:#8A8F98;margin:0 0 8px;">Agenda</p>
        <p style="font-size:14px;color:#0F1115;margin:0;white-space:pre-wrap;">${agenda}</p>
       </div>`
    : ''

  const timeBlock = time
    ? `<div>
        <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:.08em;color:#8A8F98;margin:0 0 4px;">Time</p>
        <p style="font-size:14px;color:#0F1115;font-weight:600;margin:0;">${formatTime(time)}</p>
       </div>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Meeting Invite: ${title}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;padding:0 16px 40px;">

    <!-- Card -->
    <div style="background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,0.07);overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">

      <!-- Top stripe -->
      <div style="height:4px;background:linear-gradient(90deg,#6E56CF,#36D399);"></div>

      <!-- Header -->
      <div style="padding:28px 28px 20px;border-bottom:1px solid rgba(0,0,0,0.06);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
          <div style="width:34px;height:34px;background:#6E56CF;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="color:#fff;font-weight:800;font-size:15px;line-height:1;">T</span>
          </div>
          <span style="font-size:12px;color:#8A8F98;font-weight:500;letter-spacing:.02em;">${project_name}</span>
        </div>
        <h1 style="font-size:22px;font-weight:700;color:#0F1115;margin:0 0 6px;line-height:1.25;">${title}</h1>
        <p style="font-size:13px;color:#8A8F98;margin:0;">
          📨 You've been invited by <strong style="color:#0F1115;">${host_name}</strong>
        </p>
      </div>

      <!-- Body -->
      <div style="padding:24px 28px 28px;">

        <!-- Date / Time chips -->
        <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:4px;">
          <div>
            <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:.08em;color:#8A8F98;margin:0 0 4px;">Date</p>
            <p style="font-size:15px;color:#0F1115;font-weight:600;margin:0;">${formatDate(date)}</p>
          </div>
          ${timeBlock}
        </div>

        ${agendaBlock}

        <!-- CTA -->
        ${joinButton ? `<div style="margin-top:24px;">${joinButton}</div>` : ''}

        <!-- Footer link -->
        <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(0,0,0,0.06);">
          <a href="${APP_URL}" style="font-size:13px;color:#6E56CF;text-decoration:none;font-weight:500;">
            Open Tasklane →
          </a>
        </div>
      </div>
    </div>

    <p style="text-align:center;font-size:11px;color:#8A8F98;margin-top:20px;line-height:1.5;">
      You received this because you were added as an attendee.<br>
      Sent via Tasklane · <a href="${APP_URL}" style="color:#8A8F98;">tasklane.app</a>
    </p>
  </div>
</body>
</html>`
}

// Build plain-text fallback
function buildText({ title, date, time, agenda, meeting_url, host_name, project_name }: {
  title: string; date: string; time?: string; agenda?: string;
  meeting_url?: string; host_name: string; project_name: string;
}) {
  const lines = [
    `Meeting Invite — ${project_name}`,
    '─'.repeat(40),
    `Title:   ${title}`,
    `Host:    ${host_name}`,
    `Date:    ${formatDate(date)}`,
  ]
  if (time)        lines.push(`Time:    ${formatTime(time)}`)
  if (agenda)      lines.push(`\nAgenda:\n${agenda}`)
  if (meeting_url) lines.push(`\nJoin: ${meeting_url}`)
  lines.push(`\nOpen Tasklane: ${APP_URL}`)
  return lines.join('\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Validate SMTP config
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error('SMTP_HOST, SMTP_USER, and SMTP_PASS must be set')
    return json({ error: 'SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in Edge Function secrets' }, 500)
  }

  try {
    const {
      meeting_id, title, date, time, agenda, meeting_url,
      host_name, project_name, attendee_ids,
    } = await req.json()

    if (!meeting_id || !attendee_ids?.length) {
      return json({ error: 'meeting_id and attendee_ids are required' }, 400)
    }

    // Fetch attendee emails via service role (auth.admin)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })

    const recipients: string[] = []
    for (const uid of attendee_ids as string[]) {
      const { data } = await admin.auth.admin.getUserById(uid)
      if (data?.user?.email) recipients.push(data.user.email)
    }

    if (!recipients.length) return json({ sent: 0 })

    // Create SMTP transporter
    const transporter = nodemailer.createTransport({
      host:   SMTP_HOST,
      port:   SMTP_PORT,
      secure: SMTP_PORT === 465,      // true for SSL, false for STARTTLS
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      // Increase timeouts slightly for edge function cold starts
      connectionTimeout: 10_000,
      greetingTimeout:   8_000,
      socketTimeout:     15_000,
    })

    const subject = `📅 Meeting invite: ${title} — ${formatDate(date)}${time ? ` at ${formatTime(time)}` : ''}`
    const html    = buildHtml({ title, date, time, agenda, meeting_url, host_name, project_name })
    const text    = buildText({ title, date, time, agenda, meeting_url, host_name, project_name })

    // Send to each recipient (individual so each gets a clean To: header)
    const results = await Promise.allSettled(
      recipients.map(to =>
        transporter.sendMail({ from: SMTP_FROM, to, subject, html, text })
      )
    )

    const sent   = results.filter(r => r.status === 'fulfilled').length
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason?.message ?? String(r.reason))

    if (errors.length) console.error('Some sends failed:', errors)

    return json({ sent, total: recipients.length, errors: errors.length ? errors : undefined })
  } catch (err) {
    console.error('send-meeting-invite error:', err)
    return json({ error: String(err) }, 500)
  }
})
