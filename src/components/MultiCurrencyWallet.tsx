import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TokenPurchasePanel } from './TokenPurchasePanel';

export type CurrencyCode = 'USD' | 'NGN' | 'GBP' | 'KES' | 'ZAR';

interface CurrencyConfig {
  symbol: string;
  label: string;
  rate: number; // Multiplier relative to 1 USD
}

const CURRENCY_SETTINGS: Record<CurrencyCode, CurrencyConfig> = {
  USD: { symbol: '$', label: 'US Dollar', rate: 1.0 },
  NGN: { symbol: '₦', label: 'Nigerian Naira', rate: 1500.0 },
  GBP: { symbol: '£', label: 'British Pound', rate: 0.78 },
  KES: { symbol: 'KSh', label: 'Kenyan Shilling', rate: 130.0 },
  ZAR: { symbol: 'R', label: 'South African Rand', rate: 18.2 }
};

interface MultiCurrencyWalletProps {
  currentBalance?: number;
  userId?: string;
  escrowBalance?: number;
}

export function MultiCurrencyWallet({ 
  currentBalance = 1450.00, 
  userId = "lucyjuicy10",
  escrowBalance: _escrowBalance = 0 
}: MultiCurrencyWalletProps) {
  const [activeCurrency, setActiveCurrency] = useState<CurrencyCode>('USD');
  const [baseBalanceUsd, setBaseBalanceUsd] = useState<number>(currentBalance);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCycling, setIsCycling] = useState<boolean>(false);

  // 📥 FETCH LIVE BALANCE FROM SUPABASE WITH PROFILE FALLBACK
  const fetchWalletBalance = async () => {
    setIsLoading(true);
    try {
      // 1. Try querying platform_ledger for pending earnings first
      const { data: ledgerData, error: ledgerErr } = await supabase
        .from('platform_ledger')
        .select('amount')
        .eq('recipient_id', userId)
        .eq('settlement_status', 'pending');

      if (!ledgerErr && ledgerData && ledgerData.length > 0) {
        const currentTotal = ledgerData.reduce((sum, row) => sum + Number(row.amount || 0), 0);
        setBaseBalanceUsd(currentTotal);
      } else {
        // Fallback: Try fetching from wallets table first
        const { data: walletData, error: walletErr } = await supabase
          .from('wallets')
          .select('balance_usd')
          .eq('user_id', userId)
          .maybeSingle();

        if (!walletErr && walletData && walletData.balance_usd !== null) {
          setBaseBalanceUsd(Number(walletData.balance_usd));
        } else {
          // 2. Fallback to profiles table current_balance
          const { data: profData, error: profErr } = await supabase
            .from('profiles')
            .select('current_balance')
            .eq('id', userId)
            .maybeSingle();

          if (!profErr && profData && profData.current_balance !== null && profData.current_balance !== undefined) {
            setBaseBalanceUsd(Number(profData.current_balance));
          } else {
            // 3. Keep current local/prop balance
            setBaseBalanceUsd(currentBalance);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching wallet balance:", err);
      setBaseBalanceUsd(currentBalance);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync when userId or initial prop balance updates
  useEffect(() => {
    fetchWalletBalance();
  }, [userId]);

  // Keep local balance in sync with parent component state changes (like withdrawal success)
  useEffect(() => {
    setBaseBalanceUsd(currentBalance);
  }, [currentBalance]);

  // 🔄 RE-FETCH AND CYCLE RATES ON CLICK
  const handleCycleRates = async () => {
    setIsCycling(true);
    await fetchWalletBalance();
    setTimeout(() => setIsCycling(false), 600);
  };

  // Cycle through the currency options when the balance display is clicked
  const handleCycleCurrency = () => {
    const keys = Object.keys(CURRENCY_SETTINGS) as CurrencyCode[];
    const currentIndex = keys.indexOf(activeCurrency);
    const nextIndex = (currentIndex + 1) % keys.length;
    setActiveCurrency(keys[nextIndex]);
  };

  // Compute values based on active currency configuration
  const currentCurrency = CURRENCY_SETTINGS[activeCurrency];
  const convertedBalance = (baseBalanceUsd * currentCurrency.rate).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return (
    <div id="vip-vault-wallet-card" className="w-full max-w-md mx-auto bg-zinc-950 p-4 rounded-3xl text-white">
      
      {/* ── 🎯 RETAINED: Main Core Wallet Display Component ── */}
      <div className="bg-zinc-900/90 border border-zinc-850 p-5 rounded-2xl shadow-xl">
        
        {/* Wallet Metadata Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="bg-zinc-800 text-[10px] font-mono font-black tracking-widest uppercase px-2.5 py-1 rounded-md text-zinc-300">
            VIP VAULT WALLET
          </span>
        </div>

        {/* Currency Switcher Tabs Grid */}
        <div className="grid grid-cols-5 bg-zinc-950 p-1 rounded-xl border border-zinc-900 mb-6 text-center text-xs font-bold text-zinc-500">
          {(Object.keys(CURRENCY_SETTINGS) as CurrencyCode[]).map((code) => {
            const isSelected = activeCurrency === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setActiveCurrency(code)}
                className={`py-1.5 rounded-lg font-black cursor-pointer transition ${
                  isSelected 
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md' 
                    : 'hover:text-zinc-300'
                }`}
              >
                {code}
              </button>
            );
          })}
        </div>

        {/* Live Capital Available Figure */}
        <div className="flex flex-col mb-4 select-none cursor-pointer animate-fade-in" onClick={handleCycleCurrency} title="Click to cycle display currency">
          <span className="text-xs font-medium text-zinc-500">Available Balance</span>
          {isLoading ? (
            <div className="h-10 w-32 bg-zinc-900/60 animate-pulse rounded-lg mt-1" />
          ) : (
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-zinc-500">{currentCurrency.symbol}</span>
              <span className="text-4xl font-black font-mono tracking-tight text-white">
                {convertedBalance}
              </span>
            </div>
          )}
        </div>

        {/* Synchronization Mode & Cycle Footer Links */}
        <div className="flex items-center justify-between border-t border-zinc-800/60 pt-4 mt-2 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Displaying in <span className="text-zinc-300 font-bold">{currentCurrency.label}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 text-[11px] text-zinc-600 font-mono">
          <span>Exchange Mode: <span className="text-zinc-400 font-bold">Fixed Node</span></span>
          <button 
            type="button"
            onClick={handleCycleRates}
            disabled={isCycling}
            className="flex items-center gap-1 hover:text-pink-400 font-bold transition duration-150 cursor-pointer disabled:opacity-40"
          >
            {isCycling ? '🔄 CYCLING...' : '🔄 CYCLE RATES'}
          </button>
        </div>

      </div>

      <div className="mt-4">
        <TokenPurchasePanel currentUserId={userId} />
      </div>

    </div>
  );
}

export default MultiCurrencyWallet;
