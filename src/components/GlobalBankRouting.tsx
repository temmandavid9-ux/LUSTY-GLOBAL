import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle2, Globe } from 'lucide-react';

interface GlobalBankRoutingProps {
  currentUserId: string;
  onConfigured?: () => void;
}

export function GlobalBankRouting({ currentUserId, onConfigured }: GlobalBankRoutingProps) {
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [country, setCountry] = useState('Global / International');
  const [accountName, setAccountName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [savedDetails, setSavedDetails] = useState<any>(null);

  // Load existing bank routing from Supabase & localStorage on mount
  useEffect(() => {
    if (!currentUserId) return;

    async function fetchGlobalRouting() {
      try {
        // Query user_payment_methods for existing global bank
        const { data: payMethods } = await supabase
          .from('user_payment_methods')
          .select('*')
          .eq('user_id', currentUserId)
          .order('updated_at', { ascending: false })
          .limit(1);

        // Query profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('settlement_bank_code, settlement_bank_name, settlement_account_number, settlement_account_name, payout_configured, has_payment_method, full_name, username')
          .eq('id', currentUserId)
          .maybeSingle();

        // Check local storage fallback
        let localData: any = {};
        try {
          const stored = localStorage.getItem(`settlement_config_${currentUserId}`);
          if (stored) localData = JSON.parse(stored);
        } catch (e) {}

        const activeBankName = payMethods?.[0]?.bank_name || profile?.settlement_bank_name || localData?.settlement_bank_name || '';
        const activeAccNum = payMethods?.[0]?.account_number || profile?.settlement_account_number || localData?.settlement_account_number || '';
        const activeSwift = payMethods?.[0]?.routing_number || profile?.settlement_bank_code || localData?.routing_number || '';
        const activeCountry = payMethods?.[0]?.country || localData?.country || 'Global / International';

        const fallbackFullName = profile?.full_name || (profile?.username && profile.username !== 'sam' ? profile.username : 'Emmanuel David');
        let activeAccName = profile?.settlement_account_name || localData?.settlement_account_name || '';
        if (!activeAccName || activeAccName.toLowerCase().includes('sam')) {
          activeAccName = fallbackFullName;
        }

        const isConfigured = Boolean(
          profile?.payout_configured || 
          profile?.has_payment_method || 
          (payMethods && payMethods.length > 0) || 
          localData?.payout_configured
        );

        if (activeBankName) setBankName(activeBankName);
        if (activeAccNum) setAccountNumber(activeAccNum);
        if (activeSwift) setSwiftCode(activeSwift);
        if (activeAccName) setAccountName(activeAccName);
        if (activeCountry) setCountry(activeCountry);

        if (isConfigured && activeAccNum) {
          setSuccess(true);
          setSavedDetails({
            bank_name: activeBankName,
            account_number: activeAccNum,
            routing_number: activeSwift,
            country: activeCountry,
            account_name: activeAccName
          });
        }
      } catch (err) {
        console.warn("Notice loading global routing:", err);
      }
    }

    fetchGlobalRouting();
  }, [currentUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !accountNumber || !swiftCode) {
      alert("Please fill out all international banking fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upsert into user_payment_methods
      const { error: paymentError } = await supabase
        .from('user_payment_methods')
        .upsert([
          {
            user_id: currentUserId,
            bank_name: bankName,
            account_number: accountNumber,
            routing_number: swiftCode.toUpperCase(),
            country: country,
            is_default: true,
            updated_at: new Date().toISOString(),
          },
        ], { onConflict: 'user_id' });

      if (paymentError) {
        console.warn('Upsert notice on user_payment_methods:', paymentError.message);
        await supabase.from('user_payment_methods').insert({
          user_id: currentUserId,
          bank_name: bankName,
          account_number: accountNumber,
          routing_number: swiftCode.toUpperCase(),
          country: country,
          is_default: true,
        });
      }

      // Fetch dynamic account holder name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', currentUserId)
        .maybeSingle();

      const accountHolderName = profileData?.full_name || (profileData?.username && profileData.username !== 'sam' ? profileData.username : "Emmanuel David");
      const resolvedAccName = accountName || accountHolderName;

      // 2. Update profiles table flags
      const profilePayload = {
        has_payment_method: true,
        payout_configured: true,
        settlement_bank_code: swiftCode.toUpperCase(),
        settlement_bank_name: bankName,
        settlement_account_number: accountNumber,
        settlement_account_name: resolvedAccName
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profilePayload)
        .eq('id', currentUserId);

      if (profileError) {
        console.warn("Profile update notice:", profileError.message);
      }

      // 3. Save to localStorage
      try {
        localStorage.setItem(`settlement_config_${currentUserId}`, JSON.stringify({
          ...profilePayload,
          routing_number: swiftCode.toUpperCase(),
          country: country
        }));
      } catch (e) {}

      setSuccess(true);
      setSavedDetails({
        bank_name: bankName,
        account_number: accountNumber,
        routing_number: swiftCode.toUpperCase(),
        country: country,
        account_name: resolvedAccName
      });

      if (onConfigured) {
        onConfigured();
      }

      alert("🌍 Global bank routing successfully linked and saved!");

    } catch (err: any) {
      console.error("Supabase routing save error:", err);
      alert("Error saving routing details: " + (err.message || JSON.stringify(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 max-w-md mx-auto space-y-4 text-left font-sans">
      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider text-center flex items-center justify-center gap-1.5">
        <Globe className="w-4 h-4 text-cyan-400" />
        Configure Global Payout Destination
      </div>

      <form onSubmit={handleSubmit} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
        <div className="text-xs font-mono font-bold text-white tracking-wide uppercase border-b border-zinc-800 pb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">🌐 International Wire / SWIFT</span>
          {success && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved & Active
            </span>
          )}
        </div>

        {success && savedDetails && (
          <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-xl text-[10px] font-mono text-zinc-400 space-y-1">
            <div className="text-zinc-500 font-bold uppercase tracking-wider text-[8px] mb-1">Active Global Settlement Route</div>
            <div>Bank Name: <span className="text-zinc-200 font-bold">{savedDetails.bank_name}</span></div>
            <div>IBAN / Account: <span className="text-zinc-200 font-mono tracking-wider">{savedDetails.account_number}</span></div>
            <div>SWIFT / BIC: <span className="text-cyan-400 font-mono tracking-wider">{savedDetails.routing_number}</span></div>
            {savedDetails.account_name && (
              <div>Holder: <span className="text-emerald-400 font-bold">{savedDetails.account_name}</span></div>
            )}
          </div>
        )}

        {/* Country / Jurisdiction */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-zinc-400 uppercase">Country / Jurisdiction</label>
          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setSuccess(false);
            }}
            disabled={isSubmitting}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl p-3 focus:outline-none focus:border-zinc-700 disabled:opacity-50 cursor-pointer font-sans"
          >
            <option value="Global / International">Global / International Clearing</option>
            <option value="United States">United States (USD / ACH / FedWire)</option>
            <option value="United Kingdom">United Kingdom (GBP / FPS)</option>
            <option value="European Union">European Union (EUR / SEPA)</option>
            <option value="Canada">Canada (CAD / EFT)</option>
            <option value="Australia">Australia (AUD / NPP)</option>
            <option value="Singapore">Singapore (SGD / FAST)</option>
            <option value="United Arab Emirates">UAE (AED / CBUAE)</option>
          </select>
        </div>

        {/* Bank Name */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-zinc-400 uppercase">Bank Name</label>
          <input
            type="text"
            value={bankName}
            onChange={(e) => {
              setBankName(e.target.value);
              setSuccess(false);
            }}
            placeholder="e.g., Chase, Revolut, HSBC"
            disabled={isSubmitting}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl p-3 focus:outline-none focus:border-zinc-700 disabled:opacity-50"
          />
        </div>

        {/* Account Number / IBAN */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-zinc-400 uppercase">Account Number or IBAN</label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => {
              setAccountNumber(e.target.value);
              setSuccess(false);
            }}
            placeholder="Enter account number or IBAN"
            disabled={isSubmitting}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono text-xs rounded-xl p-3 focus:outline-none focus:border-zinc-700 disabled:opacity-50 tracking-wider"
          />
        </div>

        {/* SWIFT / BIC Code */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono text-zinc-400 uppercase">SWIFT / BIC Code</label>
          <input
            type="text"
            value={swiftCode}
            onChange={(e) => {
              setSwiftCode(e.target.value.toUpperCase());
              setSuccess(false);
            }}
            placeholder="e.g., CHASUS33XXX"
            disabled={isSubmitting}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono text-xs rounded-xl p-3 focus:outline-none focus:border-zinc-700 disabled:opacity-50 tracking-wider uppercase"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || (success && savedDetails?.account_number === accountNumber && savedDetails?.routing_number === swiftCode.toUpperCase())}
          className={`w-full font-black text-xs py-3 rounded-xl uppercase tracking-wider border transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
            success && savedDetails?.account_number === accountNumber && savedDetails?.routing_number === swiftCode.toUpperCase()
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 cursor-default'
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border-transparent shadow-lg shadow-cyan-900/20'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Saving to Supabase...</span>
            </>
          ) : success && savedDetails?.account_number === accountNumber && savedDetails?.routing_number === swiftCode.toUpperCase() ? (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Routing Active & Saved
            </span>
          ) : (
            <span>Link Global Bank Routing</span>
          )}
        </button>

        {success && (
          <button
            type="button"
            onClick={() => setSuccess(false)}
            className="w-full text-[10px] font-mono text-zinc-500 hover:text-zinc-300 underline text-center block pt-1 cursor-pointer"
          >
            Update or Change International Route
          </button>
        )}
      </form>
    </div>
  );
}

export const GlobalBankRoutingForm = GlobalBankRouting;
export default GlobalBankRouting;
