import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization, Content-Type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: CORS_HEADERS 
    });
  }

  try {
    const { bank_code, account_number, business_name, business_email } = await req.json();

    if (!bank_code || !account_number || !business_name) {
      return new Response(JSON.stringify({ error: "Missing required fields (bank_code, account_number, business_name)" }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Retrieve Flutterwave Secret Key from Env. If not set, use a simulation sandbox mock ID.
    const flutterwaveSecretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
    
    if (!flutterwaveSecretKey) {
      // Return a simulated mock subaccount ID for sandbox testing when the key is not defined yet.
      const mockSubaccountId = `RS_SIMULATED_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      return new Response(JSON.stringify({ 
        success: true, 
        subaccount_id: mockSubaccountId,
        simulated: true,
        message: "Simulated subaccount generated successfully (Flutterwave secret key not configured in backend)."
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Call Flutterwave subaccounts API
    const response = await fetch("https://api.flutterwave.com/v3/subaccounts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${flutterwaveSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_bank: bank_code,
        account_number: account_number,
        business_name: business_name,
        business_email: business_email || "host-billing@lustyglobal.vip",
        split_type: "percentage",
        split_value: 0.15 // Your platform takes 15%
      })
    });

    const data = await response.json();
    
    if (response.ok && data.status === "success") {
      return new Response(JSON.stringify({ 
        success: true, 
        subaccount_id: data.data.subaccount_id,
        data: data.data 
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        error: data.message || "Failed to create Flutterwave subaccount" 
      }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
