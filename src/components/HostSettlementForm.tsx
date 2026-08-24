import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Globe, Building2, CheckCircle2 } from 'lucide-react';

interface HostSettlementFormProps {
  currentUser: { id: string; username?: string; avatar?: string; full_name?: string };
  onConfigured: () => void;
}

export function HostSettlementForm({ currentUser, onConfigured }: HostSettlementFormProps) {
  const [bankType, setBankType] = useState<'global' | 'local'>('global');
  const [country, setCountry] = useState('United States');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedDetails, setSavedDetails] = useState<any>(null);

  // Expanded Global & Regional Banks list
  const globalBanks = [
    { name: 'JPMorgan Chase (US)', swift: 'CHASUS33XXX', country: 'United States' },
    { name: 'Bank of America (US)', swift: 'BOFAUS3NXXX', country: 'United States' },
    { name: 'Wells Fargo (US)', swift: 'WFBIUS6SXXX', country: 'United States' },
    { name: 'Citibank (US)', swift: 'CITIUS33XXX', country: 'United States' },
    { name: 'HSBC Bank (UK / Global)', swift: 'MIDLGB22XXX', country: 'United Kingdom' },
    { name: 'Barclays Bank (UK)', swift: 'BARCGB22XXX', country: 'United Kingdom' },
    { name: 'Revolut (EU / UK)', swift: 'REVOLUTXXX', country: 'European Union' },
    { name: 'Wise Europe (EU)', swift: 'WISEBEBBXXX', country: 'European Union' },
    { name: 'TD Bank (Canada)', swift: 'TDOMCATTXXX', country: 'Canada' },
    { name: 'Royal Bank of Canada (Canada)', swift: 'ROYCCATTXXX', country: 'Canada' },
    { name: 'Commonwealth Bank (Australia)', swift: 'CTBAAU2SXXX', country: 'Australia' },
    { name: 'DBS Bank (Singapore)', swift: 'DBSSSGSGXXX', country: 'Singapore' },
    { name: 'Emirates NBD (UAE)', swift: 'EBIBAEADXXX', country: 'United Arab Emirates' },
    { name: 'Access Bank', swift: '044', country: 'Nigeria' },
    { name: 'Guaranty Trust Bank (GTBank)', swift: '058', country: 'Nigeria' },
    { name: 'Zenith Bank', swift: '057', country: 'Nigeria' },
    { name: 'United Bank for Africa (UBA)', swift: '033', country: 'Nigeria' },
    { name: 'First Bank of Nigeria', swift: '011', country: 'Nigeria' },
    { name: 'Kuda Bank', swift: '50211', country: 'Nigeria' },
    { name: 'OPay', swift: '100004', country: 'Nigeria' },
    { name: 'PalmPay', swift: '100033', country: 'Nigeria' },
    { name: 'Other / Custom International Bank', swift: '', country: 'Global / Other' }
  ];

  // Fetch current bank config from profiles & user_payment_methods
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
          .select('settlement_bank_code, settlement_bank_name, settlement_account_number, settlement_account_name, payout_configured, full_name, username')
          .eq('id', currentUser.id)
          .maybeSingle();

        const fallbackHolder = profile?.full_name || currentUser.full_name || (profile?.username && profile.username !== 'sam' ? profile.username : 'Emmanuel David');

        const activeBankName = payMethods?.[0]?.bank_name || profile?.settlement_bank_name || localData?.settlement_bank_name || '';
        const activeAccNum = payMethods?.[0]?.account_number || profile?.settlement_account_number || localData?.settlement_account_number || '';
        const activeSwift = payMethods?.[0]?.routing_number || profile?.settlement_bank_code || localData?.settlement_bank_code || localData?.routing_number || '';
        const activeCountry = payMethods?.[0]?.country || localData?.country || 'United States';

        let activeAccName = profile?.settlement_account_name || localData?.settlement_account_name || '';
        if (!activeAccName || activeAccName.toLowerCase().includes('sam')) {
          activeAccName = fallbackHolder;
        }

        const isConfigured = Boolean(
          profile?.payout_configured || 
          (payMethods && payMethods.length > 0) || 
          localData?.payout_configured
        );

        if (activeBankName) setBankName(activeBankName);
        if (activeAccNum) setAccountNumber(activeAccNum);
        if (activeSwift) setSwiftCode(activeSwift);
        if (activeAccName) setAccountName(activeAccName);
        if (activeCountry) setCountry(activeCountry);

        if (isConfigured && activeAccNum) {
          setSavedDetails({
            settlement_bank_name: activeBankName,
            settlement_account_number: activeAccNum,
            settlement_bank_code: activeSwift,
            settlement_account_name: activeAccName,
            country: activeCountry,
            payout_configured: true
          });
        }
      } catch (err) {
        console.warn("Could not retrieve saved bank details:", err);
      }
    }
    fetchSavedConfig();
  }, [currentUser?.id]);

  const handleSaveGlobalBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !accountNumber) {
      alert("Please provide a bank name and account number or IBAN.");
      return;
    }

    setIsSaving(true);
    try {
      // Dynamic account holder name resolution
      const { data: profData } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', currentUser.id)
        .maybeSingle();

      const accountHolderName = profData?.full_name || currentUser.full_name || (profData?.username && profData.username !== 'sam' ? profData.username : "Emmanuel David");
      const resolvedAccountName = accountName || accountHolderName;

      const updatePayload = {
        settlement_bank_name: bankName,
        settlement_account_number: accountNumber,
        settlement_bank_code: swiftCode || 'INTERNATIONAL_WIRE',
        settlement_account_name: resolvedAccountName,
        country: country,
        payout_configured: true,
        has_payment_method: true
      };

      // 1. Save to user_payment_methods table
      const { error: pmError } = await supabase
        .from('user_payment_methods')
        .upsert([{
          user_id: currentUser.id,
          bank_name: bankName,
          account_number: accountNumber,
          routing_number: swiftCode || 'INTERNATIONAL_WIRE',
          country: country,
          is_default: true,
          updated_at: new Date().toISOString()
        }], { onConflict: 'user_id' });

      if (pmError) {
        console.warn("user_payment_methods upsert notice:", pmError.message);
        await supabase
          .from('user_payment_methods')
          .insert({
            user_id: currentUser.id,
            bank_name: bankName,
            account_number: accountNumber,
            routing_number: swiftCode || 'INTERNATIONAL_WIRE',
            country: country,
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
      alert("🌍 Global bank destination successfully linked!");

    } catch (err: any) {
      console.error("Error saving global bank:", err);
      alert("Failed to save global bank routing: " + (err.message || JSON.stringify(err)));
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 mt-4 text-left font-sans animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-400" />
          <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-300 font-mono">Global Settlement Destination</h3>
        </div>
        {savedDetails?.payout_configured && (
          <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Linked
          </span>
        )}
      </div>

      {/* Active Settlement Card */}
      {savedDetails && (
        <div className="bg-zinc-950/80 border border-zinc-800 p-3 rounded-xl mb-3 text-[10px] font-mono text-zinc-400 space-y-1">
          <div className="text-zinc-500 font-bold uppercase tracking-wider text-[8px] mb-1">Active Global Destination</div>
          <div>Bank Name: <span className="text-zinc-200 font-bold">{savedDetails.settlement_bank_name}</span></div>
          <div>IBAN / Account: <span className="text-zinc-200 font-mono tracking-wider">{savedDetails.settlement_account_number}</span></div>
          {savedDetails.settlement_bank_code && (
            <div>SWIFT / Code: <span className="text-cyan-400 font-mono tracking-wider">{savedDetails.settlement_bank_code}</span></div>
          )}
          {savedDetails.settlement_account_name && (
            <div>Holder: <span className="text-emerald-400 font-bold">{savedDetails.settlement_account_name}</span></div>
          )}
        </div>
      )}

      {/* Mode / Type Toggle */}
      <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 mb-3">
        <button
          type="button"
          onClick={() => setBankType('global')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            bankType === 'global'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Globe className="w-3 h-3" />
          <span>Global / SWIFT</span>
        </button>
        <button
          type="button"
          onClick={() => setBankType('local')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            bankType === 'local'
              ? 'bg-zinc-800 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Building2 className="w-3 h-3" />
          <span>Local Clearing</span>
        </button>
      </div>

      <form onSubmit={handleSaveGlobalBank} className="space-y-3">
        {/* Country / Region */}
        <div>
          <label className="block text-[8px] uppercase font-mono text-zinc-500 mb-1">Country / Jurisdiction</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full bg-zinc-950 text-zinc-200 border border-zinc-800 rounded-xl px-2.5 py-2 text-[11px] focus:outline-none focus:border-cyan-500 cursor-pointer font-sans"
          >
            <option value="United States">United States (USD / ACH / FedWire)</option>
            <option value="United Kingdom">United Kingdom (GBP / FPS)</option>
            <option value="European Union">European Union (EUR / SEPA)</option>
            <option value="Canada">Canada (CAD / EFT)</option>
            <option value="Australia">Australia (AUD / NPP)</option>
            <option value="Singapore">Singapore (SGD / FAST)</option>
            <option value="United Arab Emirates">UAE (AED / CBUAE)</option>
            <option value="Nigeria">Nigeria (NGN / NIBSS)</option>
            <option value="Global / Other">Global / International Clearing</option>
          </select>
        </div>

        {/* Global Institution Selector & Custom Manual Input */}
        <div>
          <label className="block text-[8px] uppercase font-mono text-zinc-500 mb-1">Select Global Bank or Enter Custom</label>
          <select
            onChange={(e) => {
              const selected = globalBanks.find(b => b.name === e.target.value);
              if (selected) {
                setBankName(selected.name);
                setSwiftCode(selected.swift);
                if (selected.country) setCountry(selected.country);
              } else {
                setBankName('');
                setSwiftCode('');
              }
            }}
            className="w-full bg-zinc-950 text-zinc-200 border border-zinc-800 rounded-xl px-2.5 py-2 text-[11px] focus:outline-none focus:border-cyan-500 cursor-pointer mb-2 font-sans"
          >
            <option value="">-- Choose Global Institution --</option>
            {globalBanks.map((bank, idx) => (
              <option key={idx} value={bank.name}>{bank.name}</option>
            ))}
          </select>
          
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Or type bank name manually (e.g., Revolut, Chase, HSBC)"
            className="w-full bg-zinc-950 text-zinc-200 border border-zinc-800 rounded-xl px-2.5 py-2 text-[11px] focus:outline-none focus:border-cyan-500 font-sans"
            required
          />
        </div>

        {/* Account Number / IBAN */}
        <div>
          <label className="block text-[8px] uppercase font-mono text-zinc-500 mb-1">Account Number or IBAN</label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="Enter Account Number or IBAN"
            className="w-full bg-zinc-950 text-zinc-200 border border-zinc-800 rounded-xl px-2.5 py-2 font-mono text-[11px] tracking-wider focus:outline-none focus:border-cyan-500"
            required
          />
        </div>

        {/* SWIFT / BIC Code */}
        <div>
          <label className="block text-[8px] uppercase font-mono text-zinc-500 mb-1">SWIFT / BIC Code</label>
          <input
            type="text"
            value={swiftCode}
            onChange={(e) => setSwiftCode(e.target.value.toUpperCase())}
            placeholder="e.g., CHASUS33XXX"
            className="w-full bg-zinc-950 text-zinc-200 border border-zinc-800 rounded-xl px-2.5 py-2 font-mono text-[11px] tracking-wider uppercase focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-[10px] uppercase tracking-wider py-2.5 rounded-xl transition cursor-pointer disabled:opacity-40 shadow-lg shadow-cyan-950 active:scale-[0.98]"
        >
          {isSaving ? "Linking Global Destination..." : "Link Global Bank Routing"}
        </button>
      </form>
    </div>
  );
}

export const GlobalOrLocalSettlementForm = HostSettlementForm;
export default HostSettlementForm;
