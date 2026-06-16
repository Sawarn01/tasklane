import { createClient } from 'jsr:@supabase/supabase-js@2'

const DODO_API_KEY = Deno.env.get('DODO_PAYMENTS_API_KEY')
const DODO_API_BASE = 'https://live.dodopayments.com'

const PRODUCT_IDS: Record<string, string> = {
  pro: 'pdt_0NhAr8bSeqRYb0FH6uKfO',
  company: 'pdt_0NhArK7Gu6i5Jw6w96bPn',
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { plan, orgId, userEmail, userName } = await req.json()

    if (!plan || !PRODUCT_IDS[plan]) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch(`${DODO_API_BASE}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_cart: [{ product_id: PRODUCT_IDS[plan], quantity: 1 }],
        customer: {
          email: userEmail,
          name: userName,
        },
        metadata: {
          org_id: orgId,
          plan: plan,
        },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Dodo API error:', data)
      return new Response(JSON.stringify({ error: data.message || 'Checkout session creation failed' }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ checkoutUrl: data.checkout_url, sessionId: data.session_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error creating checkout session:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})