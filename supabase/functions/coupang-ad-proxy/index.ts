import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  console.log(`[Proxy] Request received: ${req.method} ${req.url}`);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  // Gateway Test: If x-test header is present, return 200 immediately
  if (req.headers.get('x-test') === 'true') {
    return new Response(JSON.stringify({ message: "Gateway check OK" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }

  try {
    const { method, path, params, body } = await req.json();
    console.log(`[Proxy] Processing ${method} ${path}`);

    // 2. Get API Keys from Environment Variables or DB fallback
    let ACCESS_KEY = Deno.env.get('COUPANG_AD_ACCESS_KEY');
    let SECRET_KEY = Deno.env.get('COUPANG_AD_SECRET_KEY');
    let CUSTOMER_ID = Deno.env.get('COUPANG_AD_CUSTOMER_ID');

    if (!ACCESS_KEY || !SECRET_KEY) {
      // Fallback: Fetch from app_settings table
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      
      const { data: settings } = await fetch(`${supabaseUrl}/rest/v1/app_settings?select=key,value`, {
        headers: { 'apikey': supabaseServiceKey, 'Authorization': `Bearer ${supabaseServiceKey}` }
      }).then(res => res.json());

      if (settings && Array.isArray(settings)) {
        ACCESS_KEY = settings.find(s => s.key === 'COUPANG_AD_ACCESS_KEY')?.value || ACCESS_KEY;
        SECRET_KEY = settings.find(s => s.key === 'COUPANG_AD_SECRET_KEY')?.value || SECRET_KEY;
        CUSTOMER_ID = settings.find(s => s.key === 'COUPANG_AD_CUSTOMER_ID')?.value || CUSTOMER_ID;
      }
    }

    if (!ACCESS_KEY || !SECRET_KEY || !ACCESS_KEY.trim() || !SECRET_KEY.trim()) {
      return new Response(JSON.stringify({ 
        error: 'CREDENTIALS_REQUIRED', 
        message: 'Coupang Ad API credentials not configured. Please set them in Ad Management settings.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Coupang Advertising API requires YYMMDD'T'HHmmss'Z'
    const now = new Date();
    const year = now.getUTCFullYear().toString().slice(-2);
    const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = now.getUTCDate().toString().padStart(2, '0');
    const hours = now.getUTCHours().toString().padStart(2, '0');
    const minutes = now.getUTCMinutes().toString().padStart(2, '0');
    const seconds = now.getUTCSeconds().toString().padStart(2, '0');
    const datetime = `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
    
    const queryString = params ? new URLSearchParams(params as any).toString() : '';
    const stringToSign = `${datetime}${method}${path}${queryString}`;
    
    const key = new TextEncoder().encode(SECRET_KEY);
    const message = new TextEncoder().encode(stringToSign);
    
    const hmacKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", hmacKey, message);
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const url = `https://api-gateway.coupang.com${path}${queryString ? '?' + queryString : ''}`;

    const coupangRes = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`,
        'X-Customer-Id': CUSTOMER_ID || '',
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await coupangRes.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: coupangRes.status,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Returning 200 with error object for easier frontend handling
    })
  }
})
