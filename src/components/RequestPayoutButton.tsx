import React, { useState } from 'react';
import CryptoPayoutModal from './CryptoPayoutModal';

interface RequestPayoutButtonProps {
  currentUserId: string;
  pendingBalance: number;
  escrowBalance?: number;
  settledBalance?: number;
  payoutConfigured?: boolean;
  onPayoutRequested: (amount?: number) => void;
}

export const RequestPayoutButton: React.FC<RequestPayoutButtonProps> = ({
  currentUserId,
  pendingBalance,
  escrowBalance = 0,
  settledBalance = 0,
  payoutConfigured = false,
  onPayoutRequested,
}) => {
  const [isLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Available withdrawable amount based strictly on settled/escrow balance
  const availableToWithdraw = (escrowBalance && escrowBalance > 0) ? escrowBalance : (settledBalance > 0 ? settledBalance : 0.00);
  void pendingBalance;

  // 1. Track the Input State for withdrawal amount
  const [payoutAmount, setPayoutAmount] = useState<string>(availableToWithdraw.toFixed(2));
  const [userHasEdited, setUserHasEdited] = useState<boolean>(false);

  // Sync initial payoutAmount when availableToWithdraw changes only if user hasn't typed custom input
  React.useEffect(() => {
    if (!userHasEdited) {
      setPayoutAmount(availableToWithdraw.toFixed(2));
    }
  }, [availableToWithdraw, userHasEdited]);

  const isLocalConfigured = (() => {
    if (!currentUserId) return false;
    try {
      const stored = localStorage.getItem(`settlement_config_${currentUserId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Boolean(parsed?.payout_configured || parsed?.has_payment_method || parsed?.settlement_account_number);
      }
    } catch (e) {}
    return false;
  })();

  const isConfigured = payoutConfigured || isLocalConfigured;

  const numericPayoutAmount = parseFloat(payoutAmount) || 0;

  const handleTriggerPayout = async () => {
    // 1. Validate configuration
    if (!isConfigured) {
      setErrorMsg("Please configure your Settlement Bank Details below to enable cashouts.");
      return;
    }

    if (numericPayoutAmount <= 0) {
      setErrorMsg("Please enter a valid payout amount greater than $0.00.");
      return;
    }

    // Strict balance check: cannot withdraw if requested amount exceeds available settled balance
    if (numericPayoutAmount > availableToWithdraw || availableToWithdraw <= 0) {
      setErrorMsg(`Cannot request payout. Requested amount ($${numericPayoutAmount.toFixed(2)}) exceeds available settled balance ($${availableToWithdraw.toFixed(2)}).`);
      return;
    }

    setErrorMsg(null);
    setShowConfirm(true);
  };

  const formattedAmountDisplay = payoutAmount !== '' ? payoutAmount : '0.00';

  return (
    <div className="w-full space-y-2">
      {/* 1. Track the Input State */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
          Withdrawal Amount ($)
        </label>
        <div className="relative flex items-center">
          <span className="absolute left-3 text-zinc-400 font-bold text-xs font-mono">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={payoutAmount}
            onChange={(e) => {
              setUserHasEdited(true);
              setPayoutAmount(e.target.value);
            }}
            placeholder="0.00"
            className="w-full bg-zinc-900/90 border border-zinc-800 text-white font-mono text-xs pl-7 pr-3 py-2 rounded-xl focus:outline-none focus:border-pink-500 transition"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-2 bg-red-950/40 border border-red-900/50 rounded-lg text-[10px] text-red-400 font-mono">
          {errorMsg}
        </div>
      )}

      {/* 2. Dynamic Button Text */}
      <button
        type="button"
        onClick={handleTriggerPayout}
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-black text-xs py-3 rounded-xl transition duration-150 font-mono shadow-lg cursor-pointer uppercase tracking-wider disabled:opacity-50"
      >
        {isLoading ? 'Processing Transfer...' : `REQUEST PAYOUT ($${formattedAmountDisplay})`}
      </button>

      {/* Crypto Payout Modal Overlay */}
      {showConfirm && (
        <CryptoPayoutModal
          amount={numericPayoutAmount}
          userId={currentUserId}
          settledBalance={availableToWithdraw}
          onPayoutSuccess={(disbursedAmt) => {
            onPayoutRequested(disbursedAmt);
          }}
          onClose={() => {
            setShowConfirm(false);
            onPayoutRequested(numericPayoutAmount);
          }}
        />
      )}
    </div>
  );
};
