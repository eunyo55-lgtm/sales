import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-test',
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
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      console.log(`[Proxy] Keys not in env, fetching from DB... (URL: ${supabaseUrl})`);
      
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: settings, error: dbError } = await supabaseClient
        .from('app_settings')
        .select('key, value');

      if (dbError) {
        console.error(`[Proxy] DB Fetch Error:`, dbError);
      }

      if (settings) {
        console.log(`[Proxy] Found ${settings.length} settings in DB`);
        settings.forEach((s: any) => {
          if (s.key === 'COUPANG_AD_ACCESS_KEY') {
            ACCESS_KEY = s.value;
            console.log(`[Proxy] Found ACCESS_KEY`);
          }
          if (s.key === 'COUPANG_AD_SECRET_KEY') {
            SECRET_KEY = s.value;
            console.log(`[Proxy] Found SECRET_KEY`);
          }
          if (s.key === 'COUPANG_AD_CUSTOMER_ID') {
            CUSTOMER_ID = s.value;
            console.log(`[Proxy] Found CUSTOMER_ID`);
          }
        });
      }
    }

    if (!ACCESS_KEY || !SECRET_KEY) {
      console.warn(`[Proxy] Credentials still missing after DB fetch.`);
      return new Response(JSON.stringify({ 
        error: 'CREDENTIALS_REQUIRED', 
        message: 'Coupang Ad API credentials not configured. Please set them in Ad Management settings.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Use 200 to allow frontend to handle it as a state
      });
    }

    // Coupang Advertising API v4 Signature: datetime + method + path (NO query string in signature!)
    const now = new Date();
    const year = now.getUTCFullYear().toString(); // 4-digit year
    const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = now.getUTCDate().toString().padStart(2, '0');
    const hours = now.getUTCHours().toString().padStart(2, '0');
    const minutes = now.getUTCMinutes().toString().padStart(2, '0');
    const seconds = now.getUTCSeconds().toString().padStart(2, '0');
    const datetime = `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
    
    // In Advertising API, some specs exclude query string from the signature string
    const stringToSign = `${datetime}${method}${path}`;
    
    console.log(`[Proxy] StringToSign (No Query): ${stringToSign}`);

    const encoder = new TextEncoder();
    const key = encoder.encode(SECRET_KEY);
    const message = encoder.encode(stringToSign);
    
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

    const queryString = params ? new URLSearchParams(params as any).toString() : '';
    const url = `https://api-gateway.coupang.com${path}${queryString ? '?' + queryString : ''}`;
    const authHeader = `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;
    
    console.log(`[Proxy] Calling Coupang: ${method} ${url}`);
    
    const coupangRes = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
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
