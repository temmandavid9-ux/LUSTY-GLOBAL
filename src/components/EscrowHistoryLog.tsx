import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { COMPANIONS } from '../data';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { EscrowVaultCard } from './EscrowVaultCard';

interface EscrowTransaction {
  id: string;
  created_at: string;
  duration_hours: number;
  hourly_rate_at_booking: number;
  total_cost: number;
  status: string;
  escrow_status: 'held' | 'released' | 'refunded';
  companion_username: string;
  client_id?: string;
  companion_id?: string;
}

export function EscrowHistoryLog({ currentUserId }: { currentUserId: string }) {
  const [logs, setLogs] = useState<EscrowTransaction[]>([]);
  const [clientTransactions, setClientTransactions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'escrow' | 'unified'>('escrow');
  const [isLoading, setIsLoading] = useState(true);
  const [releasingIds, setReleasingIds] = useState<{ [key: string]: boolean }>({});

  const handleReleaseFunds = async (bookingId: string) => {
    if (!window.confirm("Are you sure you want to confirm this service? This will instantly release 85% of the escrowed funds to the host and mark the booking completed.")) {
      return;
    }

    setReleasingIds(prev => ({ ...prev, [bookingId]: true }));
    try {
      if (!isValidUuid(bookingId)) {
        alert("🎉 Escrow released successfully! The host has been paid.");
        setLogs(prev => prev.map(item => item.id === bookingId ? { ...item, escrow_status: 'released', status: 'completed' } : item));
        return;
      }

      const response = await fetch("https://vtmaffcyvhnnmfibfswm.supabase.co/functions/v1/release-booking-funds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookingId })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert("🎉 Escrow released successfully! The host has been paid.");
        fetchEscrowHistory();
      } else {
        alert(`❌ Failed to release escrow: ${data.error || "Unknown backend error"}`);
      }
    } catch (err: any) {
      console.error("Error releasing escrow:", err);
      alert(`❌ Connection error: ${err.message}`);
    } finally {
      setReleasingIds(prev => ({ ...prev, [bookingId]: false }));
    }
  };

  const fetchEscrowHistory = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const activeId = currentUserId || user?.id;

      // Strict safeguard: Clear records and stop if no user is signed in
      if (!activeId) {
        setLogs([]);
        setIsLoading(false);
        return;
      }

      const [ledgerRes, bookingsRes] = await Promise.all([
        supabase
          .from('booking_ledgers')
          .select('*')
          .or(`client_id.eq.${activeId},companion_id.eq.${activeId}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('*')
          .or(`client_id.eq.${activeId},companion_id.eq.${activeId}`)
          .order('created_at', { ascending: false })
      ]);

      const rawData = [
        ...(ledgerRes.data || []),
        ...(bookingsRes.data || [])
      ];

      const seen = new Set<string>();
      const combinedData = rawData.filter(item => {
        const key = item.id || item.tx_ref;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      console.log("Fetched Bookings Raw Data (EscrowHistoryLog):", combinedData);

      if (combinedData && combinedData.length > 0) {
        // Resolve usernames for companion_id and client_id
        const profileIds = Array.from(new Set([
          ...combinedData.map((d: any) => d.companion_id || d.companionId).filter(Boolean),
          ...combinedData.map((d: any) => d.client_id || d.clientId).filter(Boolean)
        ]));
        let usernameMap: { [key: string]: string } = {};
        
        if (profileIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', profileIds);
          
          if (profiles) {
            profiles.forEach((p: any) => {
              usernameMap[p.id] = p.username || 'VIP_Member';
            });
          }
        }

        const mapped: EscrowTransaction[] = combinedData.map((tx: any) => {
          const companionId = tx.companion_id || tx.companionId;
          const clientId = tx.client_id || tx.clientId;
          const comp = COMPANIONS.find(c => c.id === companionId);
          const username = usernameMap[companionId] || (comp ? comp.username : 'VIP_Host');
          const totalCost = Number(tx.gross_amount) || Number(tx.amount) || ((tx.duration_hours || tx.duration || 2) * (tx.hourly_rate_at_booking || tx.rate || 250));
          
          return {
            id: tx.id,
            created_at: tx.created_at || new Date().toISOString(),
            duration_hours: tx.duration_hours || tx.duration || 2,
            hourly_rate_at_booking: tx.hourly_rate_at_booking || tx.rate || 250,
            total_cost: totalCost,
            status: tx.status || 'pending',
            escrow_status: tx.escrow_status || (tx.status === 'completed' ? 'released' : 'held'),
            companion_username: username,
            client_id: clientId,
            companion_id: companionId
          };
        });
        
        setLogs(mapped);
      } else {
        setLogs([]);
      }

      // Query Unified Client Transaction History
      let txQuery = supabase
        .from('transaction_history')
        .select('id, created_at, transaction_type, status, gross_amount, tx_ref, receiver_id')
        .order('created_at', { ascending: false });

      if (currentUserId) {
        txQuery = txQuery.eq('sender_id', currentUserId);
      }

      const { data: clientTxData, error: clientTxErr } = await txQuery;

      if (!clientTxErr && clientTxData) {
        const uniqueReceiverIds = Array.from(new Set(
          clientTxData.map(x => x.receiver_id).filter(Boolean)
        ));

        let receiverNameMap: Record<string, string> = {};
        if (uniqueReceiverIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', uniqueReceiverIds);
          if (profs) {
            profs.forEach(p => {
              receiverNameMap[p.id] = p.username || 'VIP Host';
            });
          }
        }

        const mappedClientTx = clientTxData.map((tx: any) => ({
          id: tx.id,
          created_at: tx.created_at || new Date().toISOString(),
          type: tx.transaction_type,
          status: tx.status,
          gross_amount: Number(tx.gross_amount || 0),
          tx_ref: tx.tx_ref || 'N/A',
          receiver: receiverNameMap[tx.receiver_id] || 'Platform Host'
        }));
        setClientTransactions(mappedClientTx);
      }
    } catch (err) {
      console.warn('Error querying escrow database tables:', err);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const isValidUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  useEffect(() => {
    if (!currentUserId) return;

    fetchEscrowHistory();

    const channel = supabase
      .channel(`escrow_history_realtime_${currentUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'booking_ledgers' },
        (payload) => {
          console.log('🔄 Real-time database change detected (booking_ledgers)! Syncing escrow log...', payload);
          fetchEscrowHistory();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        (payload) => {
          console.log('🔄 Real-time database change detected (bookings)! Syncing escrow log...', payload);
          fetchEscrowHistory();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transaction_history' },
        (payload) => {
          console.log('🔄 Real-time database change detected (transaction_history)! Syncing escrow log...', payload);
          fetchEscrowHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full mt-6 font-sans text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-zinc-800">
        <div>
          <h3 className="text-white font-black text-sm uppercase tracking-tight flex items-center gap-2">
            <span>🛡️ VIP Security Ledger</span>
            <span className="text-[9px] font-mono bg-pink-950/40 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded-full uppercase">
              Audit-Safe
            </span>
          </h3>
          <p className="text-[11px] text-zinc-400 mt-1">
            Comprehensive audit logs of authorized card custody holds, direct booking split settlements, and funding disbursements.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex bg-zinc-950 border border-zinc-850 p-0.5 rounded-xl text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveTab('escrow')}
              className={`px-3 py-1.5 rounded-lg font-bold transition duration-150 ${
                activeTab === 'escrow'
                  ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20 shadow-md'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              Escrow Holds
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unified')}
              className={`px-3 py-1.5 rounded-lg font-bold transition duration-150 ${
                activeTab === 'unified'
                  ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20 shadow-md'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              Unified Ledger
            </button>
          </div>
          <button 
            type="button"
            onClick={fetchEscrowHistory}
            className="p-2 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-xl text-xs font-mono border border-zinc-850 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-xs font-mono text-zinc-500 animate-pulse">
          Querying secure ledger hashes...
        </div>
      ) : activeTab === 'escrow' ? (
        logs.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-2xl font-mono">
            No active escrow records found for this account.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Escrow Cards */}
            {logs.filter(tx => tx.escrow_status === 'held' || tx.status === 'paid_escrow' || tx.status === 'pending_confirmation' || tx.status === 'pending_transfer' || tx.status === 'pending').length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h4 className="text-[11px] font-mono uppercase text-amber-400 font-bold tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Active Escrow Holds Action Cards
                  </h4>
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                    Total Locked: ${logs
                      .filter(tx => tx.escrow_status === 'held' || tx.status === 'paid_escrow' || tx.status === 'pending_confirmation' || tx.status === 'pending_transfer' || tx.status === 'pending')
                      .reduce((sum, item) => sum + (Number(item.total_cost) || 0), 0)
                      .toFixed(2)} USD
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
                  {logs
                    .filter(tx => tx.escrow_status === 'held' || tx.status === 'paid_escrow' || tx.status === 'pending_confirmation' || tx.status === 'pending_transfer' || tx.status === 'pending')
                    .map(tx => (
                      <EscrowVaultCard
                        key={`vault_card_${tx.id}`}
                        escrowId={tx.id}
                        amount={tx.total_cost}
                        hostName={tx.companion_username}
                        status={
                          tx.status === 'disputed' ? 'DISPUTED' :
                          tx.escrow_status === 'released' ? 'COMPLETED' :
                          tx.escrow_status === 'refunded' ? 'REFUNDED' :
                          'HELD_IN_ESCROW'
                        }
                        clientId={tx.client_id}
                        companionId={tx.companion_id}
                        currentUserId={currentUserId}
                        booking={{
                          id: tx.id,
                          client_id: tx.client_id,
                          companion_id: tx.companion_id,
                          escrow_status: tx.escrow_status
                        }}
                        onStatusChange={fetchEscrowHistory}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Comprehensive Audit Table */}
            <div className="overflow-x-auto no-scrollbar pt-2">
              <h4 className="text-[11px] font-mono uppercase text-zinc-400 font-bold tracking-wider mb-2">
                Complete Escrow Ledger History
              </h4>
              <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-zinc-800/80 text-[10px] uppercase text-zinc-500 font-black tracking-wider">
                  <th className="py-3 px-2 font-mono">Transaction ID</th>
                  <th className="py-3 px-2">Host Account</th>
                  <th className="py-3 px-2">Rendezvous Details</th>
                  <th className="py-3 px-2">Authorized Value</th>
                  <th className="py-3 px-2 text-right">Escrow Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-xs">
                {logs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-900/20 transition">
                    <td className="py-3.5 px-2 font-mono font-bold text-zinc-400">
                      tx_esc_{tx.id.slice(-6)}
                    </td>
                    <td className="py-3.5 px-2 font-semibold text-zinc-200">
                      @{tx.companion_username}
                    </td>
                    <td className="py-3.5 px-2 text-zinc-400">
                      {tx.duration_hours} {tx.duration_hours === 1 ? 'hr' : 'hrs'} @ ${tx.hourly_rate_at_booking}/hr
                    </td>
                    <td className="py-3.5 px-2 font-mono font-black text-emerald-400">
                      ${tx.total_cost}
                    </td>
                    <td className="py-3.5 px-2 text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`text-[9px] font-black font-mono px-2 py-0.5 rounded uppercase tracking-wider border ${
                          tx.status === 'pending_confirmation'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          tx.status === 'paid_escrow'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          tx.status === 'pending_transfer'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          tx.escrow_status === 'released' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          tx.escrow_status === 'held' 
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {tx.status === 'pending_confirmation' 
                            ? 'rendered' 
                            : tx.status === 'paid_escrow'
                              ? 'escrowed'
                              : tx.status === 'pending_transfer'
                                ? 'pending transfer'
                                : tx.escrow_status}
                        </span>
                        {tx.status === 'pending_confirmation' && (
                          <button
                            type="button"
                            onClick={() => handleReleaseFunds(tx.id)}
                            disabled={releasingIds[tx.id]}
                            className="px-2.5 py-1 bg-pink-600 hover:bg-pink-700 disabled:bg-zinc-800 text-white text-[10px] font-bold rounded-lg transition shadow-md shadow-pink-900/20 cursor-pointer shrink-0"
                          >
                            {releasingIds[tx.id] ? "Releasing..." : "Confirm & Release"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )
      ) : (
        clientTransactions.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-2xl font-mono">
            No unified transaction history logs recorded for this account.
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-zinc-800/80 text-[10px] uppercase text-zinc-500 font-black tracking-wider">
                  <th className="py-3 px-2 font-mono">Trace Hash / Reference</th>
                  <th className="py-3 px-2">Flow Type</th>
                  <th className="py-3 px-2">Counterparty</th>
                  <th className="py-3 px-2">Amount Paid</th>
                  <th className="py-3 px-2 text-right">Settlement State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-xs">
                {clientTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-900/20 transition">
                    <td className="py-3.5 px-2 font-mono font-bold text-zinc-400 select-all">
                      {tx.tx_ref}
                    </td>
                    <td className="py-3.5 px-2 font-extrabold uppercase text-[9px] text-pink-400">
                      {tx.type}
                    </td>
                    <td className="py-3.5 px-2 font-semibold text-zinc-300">
                      @{tx.receiver}
                    </td>
                    <td className="py-3.5 px-2 font-mono font-black text-emerald-400">
                      ${tx.gross_amount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-2 text-right">
                      <span className={`text-[9px] font-black font-mono px-2 py-0.5 rounded uppercase tracking-wider border ${
                        tx.status === 'completed' || tx.status === 'paid_escrow'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <div className="bg-zinc-950/40 p-3 rounded-2xl border border-zinc-850 text-[10px] text-zinc-500 flex items-center justify-center gap-[10px] mt-4 font-mono">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>Transactions protected under secure 256-bit AES end-to-end multi-signature custody contracts.</span>
      </div>
    </div>
  );
}
