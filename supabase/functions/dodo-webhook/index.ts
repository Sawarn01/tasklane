import { createClient } from 'jsr:@supabase/supabase-js@2'

const WEBHOOK_SECRET = Deno.env.get('DODO_PAYMENTS_WEBHOOK_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function verifySignature(rawBody: string, webhookId: string, timestamp: string, signatureHeader: string) {
  // Standard Webhooks: secret is base64-encoded, often prefixed "whsec_"
  const secretKey = WEBHOOK_SECRET.startsWith('whsec_') ? WEBHOOK_SECRET.slice(6) : WEBHOOK_SECRET
  const keyBytes = Uint8Array.from(atob(secretKey), (c) => c.charCodeAt(0))

  const signedContent = `${webhookId}.${timestamp}.${rawBody}`

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBytes = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(signedContent))
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))

  // header format: "v1,<base64sig>" possibly multiple space-separated signatures
  const providedSignatures = signatureHeader.split(' ').map((s) => s.split(',')[1])

  return providedSignatures.includes(expectedSignature)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const rawBody = await req.text()
  const webhookId = req.headers.get('webhook-id') || ''
  const timestamp = req.headers.get('webhook-timestamp') || ''
  const signature = req.headers.get('webhook-signature') || ''

  try {
    const isValid = await verifySignature(rawBody, webhookId, timestamp, signature)
    if (!isValid) {
      console.error('Invalid webhook signature')
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 })
    }
  } catch (err) {
    console.error('Signature verification error:', err)
    return new Response(JSON.stringify({ error: 'Signature verification failed' }), { status: 401 })
  }

  const event = JSON.parse(rawBody)
  const eventType = event.type || event.event_type

  console.log('Received Dodo webhook:', eventType, 'id:', webhookId)

  try {
    if (eventType === 'subscription.active' || eventType === 'payment.succeeded') {
      const orgId = event.data?.metadata?.org_id
      const plan = event.data?.metadata?.plan
      const customerId = event.data?.customer?.customer_id || event.data?.customer_id
      const subscriptionId = event.data?.subscription_id || event.data?.id

      if (orgId && plan) {
        const { error } = await supabase
          .from('organizations')
          .update({
            plan,
            dodo_customer_id: customerId,
            dodo_subscription_id: subscriptionId,
          })
          .eq('id', orgId)

        if (error) {
          console.error('Failed to update org plan:', error)
        } else {
          console.log(`Upgraded org ${orgId} to ${plan}`)
        }
      } else {
        console.error('Missing org_id or plan in webhook metadata', event.data?.metadata)
      }
    }

    if (eventType === 'subscription.cancelled' || eventType === 'subscription.expired' || eventType === 'subscription.failed') {
      const orgId = event.data?.metadata?.org_id
      if (orgId) {
        const { error } = await supabase
          .from('organizations')
          .update({ plan: 'free' })
          .eq('id', orgId)

        if (error) {
          console.error('Failed to downgrade org plan:', error)
        } else {
          console.log(`Downgraded org ${orgId} to free after ${eventType}`)
        }
      }
    }
  } catch (err) {
    console.error('Error processing webhook event:', err)
    // still return 200 so Dodo doesn't endlessly retry on our internal bug,
    // but the console.error above gives us something to debug from logs
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})