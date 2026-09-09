import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Wallet, CheckCircle2, ShieldCheck } from 'lucide-react';

interface HostSettlementFormProps {
  currentUser: { id: string; username?: string; avatar?: string; full_name?: string };
  onConfigured: () => void;
}

export function HostSettlementForm({ currentUser, onConfigured }: HostSettlementFormProps) {
  const [walletAddress, setWalletAddress] = useState('TGQPfachyfMFDkhmWPbBC3syXumByzcrRk');
  const [isSaving, setIsSaving] = useState(false);
  const [savedDetails, setSavedDetails] = useState<any>(null);

  // Fetch current crypto settlement config from profiles & user_payment_methods
  useEffect(() => {
    async function fetchSavedConfig() {
      if (!currentUser?.id) return;
      try {
        let localData: any = {};
        const localDataStr = localStorage.getItem(`settlement_config_${currentUser.id}`);
        if (localDataStr) {
          try {
            localData = JSON.parse(localDataStr);
          } catch (e) {}
        }

        const { data: payMethods } = await supabase
          .from('user_payment_methods')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        const { data: profile } = await supabase
          .from('profiles')
          .select('settlement_bank_name, settlement_account_number, payout_configured')
          .eq('id', currentUser.id)
          .maybeSingle();

        const activeWallet = payMethods?.[0]?.account_number || profile?.settlement_account_number || localData?.settlement_account_number || 'TGQPfachyfMFDkhmWPbBC3syXumByzcrRk';
        const isConfigured = Boolean(
          profile?.payout_configured || 
          (payMethods && payMethods.length > 0) || 
          localData?.payout_configured
        );

        if (activeWallet) setWalletAddress(activeWallet);

        if (isConfigured && activeWallet) {
          setSavedDetails({
            settlement_bank_name: 'Binance USDT (TRC-20)',
            settlement_account_number: activeWallet,
            payout_configured: true
          });
        }
      } catch (err) {
        console.warn("Could not retrieve saved crypto wallet details:", err);
      }
    }
    fetchSavedConfig();
  }, [currentUser?.id]);

  const handleSaveCryptoWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress || !walletAddress.startsWith('T')) {
      alert("Please enter a valid TRC-20 USDT wallet address starting with 'T'.");
      return;
    }

    setIsSaving(true);
    try {
      const updatePayload = {
        settlement_bank_name: 'Binance USDT (TRC-20)',
        settlement_account_number: walletAddress,
        settlement_bank_code: 'TRC20',
        settlement_account_name: currentUser.username || currentUser.full_name || 'VIP Host',
        country: 'Global Crypto Network',
        payout_configured: true,
        has_payment_method: true
      };

      // 1. Save to user_payment_methods table
      const { error: pmError } = await supabase
        .from('user_payment_methods')
        .upsert([{
          user_id: currentUser.id,
          bank_name: 'Binance USDT (TRC-20)',
          account_number: walletAddress,
          routing_number: 'TRC20',
          country: 'Global Crypto',
          is_default: true,
          updated_at: new Date().toISOString()
        }], { onConflict: 'user_id' });

      if (pmError) {
        console.warn("user_payment_methods upsert notice:", pmError.message);
        await supabase
          .from('user_payment_methods')
          .insert({
            user_id: currentUser.id,
            bank_name: 'Binance USDT (TRC-20)',
            account_number: walletAddress,
            routing_number: 'TRC20',
            country: 'Global Crypto',
            is_default: true
          });
      }

      // 2. Save to localStorage for instant client fallback
      try {
        localStorage.setItem(`settlement_config_${currentUser.id}`, JSON.stringify(updatePayload));
      } catch (e) {}

      // 3. Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', currentUser.id);

      if (profileError) {
        console.warn("Profiles update notice:", profileError.message);
      }

      setIsSaving(false);
      setSavedDetails(updatePayload);
      onConfigured();
      alert("💎 USDT (TRC-20) Payout Destination successfully linked!");

    } catch (err: any) {
      console.error("Error saving crypto wallet:", err);
      alert("Failed to save wallet routing: " + (err.message || JSON.stringify(err)));
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 mt-4 text-left font-sans animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-300 font-mono">Decentralized USDT Payout Destination</h3>
        </div>
        {savedDetails?.payout_configured && (
          <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Secured
          </span>
        )}
      </div>

      {/* Active Settlement Card */}
      {savedDetails && (
        <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-xl mb-3 text-[10px] font-mono text-zinc-400 space-y-1">
          <div className="text-zinc-500 font-bold uppercase tracking-wider text-[8px] mb-1">Active Payout Node</div>
          <div>Network: <span className="text-emerald-400 font-bold">USDT (TRC-20)</span></div>
          <div>Destination Address: <span className="text-zinc-200 font-mono tracking-wider break-all">{savedDetails.settlement_account_number}</span></div>
        </div>
      )}

      <form onSubmit={handleSaveCryptoWallet} className="space-y-3">
        {/* Network Badge */}
        <div className="bg-emerald-950/30 border border-emerald-500/20 p-2.5 rounded-xl flex items-center gap-2 text-[10px] text-emerald-300 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>All host settlements, earnings, and withdrawals are automatically routed via TRC-20 blockchain protocol.</span>
        </div>

        {/* Wallet Address Input */}
        <div>
          <label className="block text-[8px] uppercase font-mono text-zinc-500 mb-1">Binance USDT (TRC-20) Wallet Address</label>
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="Enter TRC-20 Wallet Address (e.g., TGQPfachyfMFDkhmWPbBC3syXumByzcrRk)"
            className="w-full bg-zinc-950 text-zinc-200 border border-zinc-800 rounded-xl px-2.5 py-2 font-mono text-[11px] tracking-wider focus:outline-none focus:border-emerald-500"
            required
          />
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-[10px] uppercase tracking-wider py-2.5 rounded-xl transition cursor-pointer disabled:opacity-40 shadow-lg shadow-emerald-950 active:scale-[0.98]"
        >
          {isSaving ? "Saving Crypto Node..." : "Link USDT (TRC-20) Wallet"}
        </button>
      </form>
    </div>
  );
}

export const GlobalOrLocalSettlementForm = HostSettlementForm;
export default HostSettlementForm;
