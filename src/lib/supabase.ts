/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vtmaffcyvhnnmfibfswm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0bWFmZmN5dmhubm1maWJmc3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjI5NTksImV4cCI6MjA5NzUzODk1OX0.jmTvnNaky2hf8c32-yFXrOlAWd6hX02u5Qa957gt5xk';

const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  try {
    const res = await fetch(input, init);
    
    // Log non-2xx API errors directly to dev console for easy debugging
    if (!res.ok) {
      const clonedRes = res.clone();
      clonedRes.text().then((text) => {
        console.error(`[Supabase API Error ${res.status}]`, input.toString(), text);
      }).catch(() => {});
    }

    return res;
  } catch (err: any) {
    // Only catch physical client-side offline / network failure exceptions
    console.warn("Supabase physical network error:", err);
    
    return new Response(JSON.stringify({ error: 'Network offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: customFetch
  }
});
