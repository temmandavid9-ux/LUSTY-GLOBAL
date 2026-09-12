import { useState } from 'react';
import { Wallet, Coins, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface CryptoWithdrawalProps {
  availableBalance?: number;
  onWithdraw?: (details: { walletAddress: string; network: string; amount: number }) => Promise<void>;
}

export function HostCryptoWithdrawalPage({ availableBalance = 0.00, onWithdraw }: CryptoWithdrawalProps) {
  const [walletAddress, setWalletAddress] = useState('');
  const [network, setNetwork] = useState('TRC20');
  const [amount, setAmount] = useState(availableBalance.toString());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      setError('Please enter a valid withdrawal amount.');
      return;
    }
    if (withdrawAmount > availableBalance) {
      setError('Requested amount exceeds your available balance.');
      return;
    }
    if (!walletAddress || walletAddress.length < 20) {
      setError('Please enter a valid crypto wallet address.');
      return;
    }

    try {
      setIsLoading(true);
      if (onWithdraw) {
        await onWithdraw({ walletAddress, network, amount: withdrawAmount });
      } else {
        const res = await fetch('/api/host/payout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress, network, amount: withdrawAmount })
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message || 'Crypto payout request failed.');
        }
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Crypto payout request failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-[#0e1117] border border-zinc-800 rounded-3xl p-6 space-y-6 font-sans text-white shadow-xl">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Crypto Payouts</h2>
          <p className="text-xs text-zinc-400 font-mono">Disburse earnings to your USDT wallet</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-2 rounded-2xl">
          <Coins className="w-5 h-5" />
        </div>
      </div>

      {/* Balance Card */}
      <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Available Balance</span>
          <div className="text-2xl font-black font-mono text-amber-400 mt-0.5">
            ${availableBalance.toFixed(2)} USDT
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg text-zinc-300">
            Net Split Earnings
          </span>
        </div>
      </div>

      {success ? (
        <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-2xl p-6 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="font-bold text-sm text-emerald-200">Crypto Withdrawal Dispatched</h3>
          <p className="text-xs text-zinc-400">
            Your transfer of <span className="text-white font-bold">${parseFloat(amount).toFixed(2)} USDT</span> has been sent to your wallet.
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="mt-2 text-xs font-bold font-mono text-amber-400 hover:underline cursor-pointer"
          >
            Make another withdrawal
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {error && (
            <div className="bg-rose-950/50 border border-rose-800/60 rounded-xl p-3 flex items-center gap-2.5 text-xs text-rose-300 font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider">
              Network
            </label>
            <div className="relative">
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-3 text-xs font-mono text-white appearance-none focus:outline-none focus:border-amber-400 transition"
              >
                <option value="TRC20">TRON (TRC-20) - Recommended</option>
                <option value="ERC20">Ethereum (ERC-20)</option>
                <option value="BEP20">Binance Smart Chain (BEP-20)</option>
              </select>
              <Wallet className="w-4 h-4 text-zinc-500 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider">
              USDT Wallet Address
            </label>
            <input
              type="text"
              placeholder="Paste your wallet address here (e.g. TCFG...)"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-3 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider">
              Withdrawal Amount (USDT)
            </label>
            <input
              type="number"
              step="0.01"
              max={availableBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3.5 py-3 text-xs font-mono text-white focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || availableBalance <= 0}
            className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 disabled:opacity-50 text-black font-extrabold text-xs uppercase tracking-wider py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-amber-950/20 cursor-pointer mt-2"
          >
            <span>{isLoading ? 'Broadcasting Transfer...' : 'Request Crypto Payout'}</span>
            {!isLoading && <ArrowUpRight className="w-4 h-4" />}
          </button>
        </form>
      )}

    </div>
  );
}
