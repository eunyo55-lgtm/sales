import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { method, path, params, body } = await req.json()

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

    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    // Format: YYYYMMDDTHHMMSSZ
    
    // HMAC Signature Generation (Simplified for conceptual implementation)
    // Note: Actual Coupang HMAC depends on the specific API (Partners vs Advertising)
    // For Advertising API, it usually follows the standard Coupang mechanism:
    // String to sign: {timestamp}{method}{path}{query_string}
    
    const queryString = params ? new URLSearchParams(params).toString() : '';
    const stringToSign = `${timestamp}${method}${path}${queryString}`;
    
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
        'Authorization': `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, timestamp=${timestamp}, signature=${signature}`,
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
      status: 400,
    })
  }
})
