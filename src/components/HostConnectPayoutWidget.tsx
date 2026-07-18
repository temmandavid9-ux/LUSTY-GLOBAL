import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface ConnectPayoutProps {
  currentUserId: string;
  hostProfile: {
    connected_payout_id?: string | null;
    is_payout_verified?: boolean;
    username?: string;
  };
  onRefreshProfile: () => void; // Reloads profile data from Supabase after onboarding completes
}

export function HostConnectPayoutWidget({ currentUserId, hostProfile, onRefreshProfile }: ConnectPayoutProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleVerifyProfile = async (userId: string) => {
    try {
      const simulatedConnectId = `acct_glob_${Math.random().toString(36).substring(2, 10)}`;
      const { error } = await supabase
        .from('profiles')
        .update({
          is_payout_verified: true,
          connected_payout_id: simulatedConnectId,
          // Add any payment gateway payout routing references here
        })
        .eq('id', userId);

      if (error) throw error;
      console.log("✅ Verification saved to database successfully!");
      
      // Only reload or update local state AFTER the database acknowledges success
      onRefreshProfile();
      window.location.reload(); 
    } catch (err: any) {
      console.error("🚨 Verification failed to save:", err.message);
      setErrorMessage(err.message || "Verification failed to save.");
    }
  };

  const handleStartPayoutOnboarding = async () => {
    setIsRedirecting(true);
    setErrorMessage(null);

    try {
      // 1. Hit an edge function or secure route to generate an onboarding URL
      // In a mock/development environment, we simulate the secure link generation
      console.log(`Generating personalized onboarding token for client node: ${currentUserId}`);
      
      // Simulate calling an API endpoint that creates the Stripe Connect / Payoneer session link
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // 2. Execute verification and state reload securely using the handleVerifyProfile pipeline
      await handleVerifyProfile(currentUserId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to establish secure handshake with payment node.');
    } finally {
      setIsRedirecting(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-white font-black text-sm uppercase tracking-tight">Global Payout Portal</h3>
          <p className="text-[11px] text-zinc-400 mt-1">
            We partner with premier payment networks to route local bank deposits securely across Europe, America, and Africa.
          </p>
        </div>
        
        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${
          hostProfile?.is_payout_verified 
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
        }`}>
          {hostProfile?.is_payout_verified ? 'Active' : 'Setup Required'}
        </span>
      </div>

      {/* 💳 Connected Success View */}
      {hostProfile?.is_payout_verified ? (
        <div className="mt-5 space-y-4">
          <div className="bg-zinc-950/80 border border-zinc-850 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <span className="text-[10px] text-zinc-500 font-bold block uppercase">Linked Ledger Node</span>
                <span className="text-white font-mono text-xs font-bold mt-0.5 block">
                  {hostProfile.connected_payout_id}
                </span>
              </div>
            </div>
            <span className="text-zinc-500 font-mono text-xs">GLOBAL</span>
          </div>
          
          <button 
            onClick={handleStartPayoutOnboarding}
            className="w-full bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Manage Banking Dashboard
          </button>
        </div>
      ) : (
        /* 🚨 Unlinked Setup Invitation View */
        <div className="mt-5 space-y-4">
          <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-850 text-[11px] text-zinc-400 leading-relaxed font-mono">
            💡 Clicking below securely opens our localized payment onboarding portal. You will be able to select your native country, currency, and route deposits directly to any domestic account number, checking account, or IBAN.
          </div>

          <button
            onClick={handleStartPayoutOnboarding}
            disabled={isRedirecting}
            className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer ${
              isRedirecting 
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-850' 
                : 'bg-pink-600 text-white hover:bg-pink-700 active:scale-[0.99]'
            }`}
          >
            {isRedirecting ? (
              <>
                <span className="w-3 h-3 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
                Launching Secure Portal...
              </>
            ) : (
              '🚀 Link Bank via Set Up Payouts'
            )}
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 p-3 rounded-xl text-xs bg-red-950/20 border border-red-800/60 text-red-400 font-medium">
          ⚠️ {errorMessage}
        </div>
      )}
    </div>
  );
}
