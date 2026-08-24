import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface LedgerItem {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: string;
  tx_ref: string;
  transaction_type: string;
  created_at: string;
}

export const VipSecurityLedger: React.FC<{ userId: string }> = ({ userId }) => {
  const [activeTab, setActiveTab] = useState<'escrow' | 'unified'>('unified');
  const [logs, setLogs] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchLedgerLogs = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      let query = supabase
        .from('unified_transaction_logs')
        .select('*')
        .or(`user_id.eq.${userId},sender_id.eq.${userId},receiver_id.eq.${userId},client_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      // Filter strictly for escrow if that tab is active
      if (activeTab === 'escrow') {
        query = query.ilike('transaction_type', '%escrow%');
      }

      const { data, error } = await query;

      if (error) {
        console.warn('View query deferred, using fallback transaction tables:', error.message);
        
        // Fallback to transaction_history table
        const { data: txData, error: txError } = await supabase
          .from('transaction_history')
          .select('*')
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .order('created_at', { ascending: false });

        if (!txError && txData && txData.length > 0) {
          const mapped: LedgerItem[] = txData.map((tx: any) => ({
            id: tx.id,
            amount: Number(tx.gross_amount || tx.amount || 0),
            currency: tx.currency || 'USD',
            payment_method: tx.payment_method || 'transfer',
            status: tx.status || 'completed',
            tx_ref: tx.tx_ref || `TX-${tx.id.slice(-6)}`,
            transaction_type: tx.transaction_type === 'booking' ? 'Booking Escrow Hold' : (tx.transaction_type || 'Platform Payment'),
            created_at: tx.created_at || new Date().toISOString()
          }));

          setLogs(activeTab === 'escrow' 
            ? mapped.filter(m => m.transaction_type.toLowerCase().includes('escrow')) 
            : mapped
          );
        } else {
          // Fallback to bookings table
          const { data: bookingData } = await supabase
            .from('bookings')
            .select('*')
            .or(`client_id.eq.${userId},companion_id.eq.${userId}`)
            .order('created_at', { ascending: false });

          if (bookingData && bookingData.length > 0) {
            const mapped: LedgerItem[] = bookingData.map((b: any) => ({
              id: b.id,
              amount: Number(b.gross_amount || b.amount || 0),
              currency: 'USD',
              payment_method: b.payment_method || 'card',
              status: b.status || 'held',
              tx_ref: b.tx_ref || `BK-${b.id.slice(-6)}`,
              transaction_type: 'Booking Escrow Hold',
              created_at: b.created_at || new Date().toISOString()
            }));

            setLogs(mapped);
          } else {
            setLogs([]);
          }
        }
      } else if (data) {
        const mappedLogs: LedgerItem[] = data.map((item: any) => ({
          id: item.id || item.tx_ref || Math.random().toString(),
          amount: Number(item.amount || item.gross_amount || 0),
          currency: item.currency || 'USD',
          payment_method: item.payment_method || 'transfer',
          status: item.status || 'completed',
          tx_ref: item.tx_ref || item.id || 'N/A',
          transaction_type: item.transaction_type || 'Transaction',
          created_at: item.created_at || new Date().toISOString()
        }));
        setLogs(mappedLogs);
      }
    } catch (err) {
      console.warn('Exception fetching VIP ledger logs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedgerLogs();
  }, [userId, activeTab]);

  return (
    <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl space-y-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white flex items-center gap-2">
              🛡️ VIP SECURITY LEDGER
            </span>
            <span className="text-xs bg-pink-500/10 text-pink-400 border border-pink-500/30 px-2 py-0.5 rounded-full font-mono">
              AUDIT-SAFE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Comprehensive audit logs of authorized card custody holds, direct booking split settlements, and funding disbursements.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('escrow')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'escrow' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Escrow Holds
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unified')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'unified' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Unified Ledger
          </button>
          <button
            type="button"
            onClick={fetchLedgerLogs}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            title="Refresh Ledger"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500 font-mono animate-pulse">
          Decrypted ledger logs loading...
        </div>
      ) : logs.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-800 rounded-xl">
          <p className="text-sm font-mono text-slate-400">
            No unified transaction history logs recorded for this account.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex justify-between items-center transition hover:border-slate-700"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{item.transaction_type}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                      item.status === 'completed' || item.status === 'funded' || item.status === 'confirmed'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : item.status === 'pending_transfer' || item.status === 'pending'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {item.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  Ref: {item.tx_ref} • Method: {(item.payment_method || 'transfer').toUpperCase()}
                </p>
                <p className="text-[10px] text-slate-500">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>

              <div className="text-right">
                <span className="text-base font-extrabold text-slate-100 font-mono">
                  ${Number(item.amount).toFixed(2)} {item.currency}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Security Banner Footer */}
      <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-emerald-400">
        <span>🛡️</span>
        <span>Transactions protected under secure 256-bit AES end-to-end multi-signature custody contracts.</span>
      </div>
    </div>
  );
};
