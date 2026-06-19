import { createClient } from 'jsr:@supabase/supabase-js@2'

const RESEND_API_KEY      = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL             = Deno.env.get('APP_URL') || 'https://tasklane.app'
const FROM_EMAIL          = Deno.env.get('FROM_EMAIL') || 'meetings@tasklane.app'

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
  // t is "HH:MM:SS" from Postgres
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${pad2(m)} ${ampm}`
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function buildHtml({
  title, date, time, agenda, meeting_url, host_name, project_name, meeting_id,
}: {
  title: string, date: string, time?: string, agenda?: string,
  meeting_url?: string, host_name: string, project_name: string, meeting_id: string,
}) {
  const joinButton = meeting_url
    ? `<a href="${meeting_url}" style="display:inline-block;padding:12px 28px;background:#6E56CF;color:#fff;border-radius:10px;font-weight:600;text-decoration:none;font-size:14px;margin-top:8px;">Join Meeting</a>`
    : ''

  const agendaSection = agenda
    ? `<div style="margin-top:20px;padding:16px;background:#F1EFE7;border-radius:10px;">
        <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:.08em;color:#8A8F98;margin:0 0 8px;">Agenda</p>
        <p style="font-size:14px;color:#0F1115;margin:0;white-space:pre-wrap;">${agenda}</p>
       </div>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;padding:0 16px;">
    <div style="background:#fff;border-radius:16px;border:1px solid rgba(0,0,0,0.06);overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

      <!-- Header -->
      <div style="padding:28px 28px 20px;border-bottom:1px solid rgba(0,0,0,0.06);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <div style="width:32px;height:32px;background:#6E56CF;border-radius:8px;display:flex;align-items:center;justify-content:center;">
            <span style="color:#fff;font-weight:700;font-size:14px;">T</span>
          </div>
          <span style="font-size:12px;color:#8A8F98;font-weight:500;">${project_name}</span>
        </div>
        <h1 style="font-size:20px;font-weight:700;color:#0F1115;margin:0 0 4px;">${title}</h1>
        <p style="font-size:13px;color:#8A8F98;margin:0;">You've been invited by ${host_name}</p>
      </div>

      <!-- Details -->
      <div style="padding:24px 28px;">
        <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:20px;">
          <div>
            <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:.08em;color:#8A8F98;margin:0 0 4px;">Date</p>
            <p style="font-size:14px;color:#0F1115;font-weight:600;margin:0;">${formatDate(date)}</p>
          </div>
          ${time ? `<div>
            <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:.08em;color:#8A8F98;margin:0 0 4px;">Time</p>
            <p style="font-size:14px;color:#0F1115;font-weight:600;margin:0;">${formatTime(time)}</p>
          </div>` : ''}
        </div>

        ${agendaSection}

        ${joinButton ? `<div style="margin-top:24px;">${joinButton}</div>` : ''}

        <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(0,0,0,0.06);">
          <a href="${APP_URL}/projects" style="font-size:13px;color:#6E56CF;text-decoration:none;">Open in Tasklane →</a>
        </div>
      </div>
    </div>

    <p style="text-align:center;font-size:11px;color:#8A8F98;margin-top:20px;">
      You received this because you were added as an attendee.
    </p>
  </div>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  if (!RESEND_API_KEY) {
    return json({ error: 'RESEND_API_KEY not configured' }, 500)
  }

  try {
    const {
      meeting_id, title, date, time, agenda, meeting_url,
      host_name, project_name, attendee_ids,
    } = await req.json()

    if (!meeting_id || !attendee_ids?.length) {
      return json({ error: 'meeting_id and attendee_ids required' }, 400)
    }

    // Use service role to fetch attendee emails from auth.users
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })

    const emailResults: { id: string; email: string }[] = []
    for (const uid of attendee_ids) {
      const { data } = await admin.auth.admin.getUserById(uid)
      if (data?.user?.email) {
        emailResults.push({ id: uid, email: data.user.email })
      }
    }

    if (!emailResults.length) return json({ sent: 0 })

    const html = buildHtml({ title, date, time, agenda, meeting_url, host_name, project_name, meeting_id })

    const results = await Promise.allSettled(
      emailResults.map(({ email }) =>
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: email,
            subject: `📅 Meeting invite: ${title} — ${formatDate(date)}${time ? ` at ${formatTime(time)}` : ''}`,
            html,
          }),
        }).then(r => r.json())
      )
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    return json({ sent, total: emailResults.length })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})
