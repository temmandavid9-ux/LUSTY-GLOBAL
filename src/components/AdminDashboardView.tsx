import { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { COMPANIONS } from '../data';
import { BarChart3, TrendingUp, AlertCircle, ShieldAlert, CreditCard, Video, Loader2, RefreshCw } from 'lucide-react';
import { Booking } from '../types';
import { EscrowLinkCardForm } from './EscrowLinkCardForm';
import { EscrowHistoryLog } from './EscrowHistoryLog';

interface AdminDashboardViewProps {
  bookings: Booking[];
  escrowBalance: number;
  currentUserProfile?: any;
  onRefreshProfile?: () => void;
}

export default function AdminDashboardView({ 
  bookings, 
  escrowBalance, 
  currentUserProfile, 
  onRefreshProfile 
}: AdminDashboardViewProps) {
  // Compute analytics
  const totalBookingsCount = bookings.length;
  const activeEscrowsCount = bookings.filter(b => b.status === 'escrowed').length;
  const completedBookings = bookings.filter(b => b.status === 'completed').length;

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);

  const runWatermarkScript = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setProgressLog(["Starting watermarking script..."]);
    setProcessedCount(0);
    setTotalFiles(0);

    const toastId = toast.loading("Connecting to Supabase storage...", {
      style: { background: '#09090b', color: '#f4f4f5', border: '1px solid #27272a' }
    });

    try {
      setProgressLog(prev => [...prev, "Listing files in 'lounge-shorts' bucket..."]);
      const { data: files, error } = await supabase.storage
        .from('lounge-shorts')
        .list();

      if (error) {
        throw new Error(`Error listing storage files: ${error.message}`);
      }

      if (!files || files.length === 0) {
        setProgressLog(prev => [...prev, "⚠️ No files found in 'lounge-shorts' bucket."]);
        toast.error("No files found in lounge-shorts bucket.", { id: toastId });
        setIsProcessing(false);
        return;
      }

      const mp4Files = files.filter(f => f.name.endsWith('.mp4'));
      setTotalFiles(mp4Files.length);

      if (mp4Files.length === 0) {
        setProgressLog(prev => [...prev, "⚠️ No .mp4 files found to watermark."]);
        toast.error("No .mp4 files found.", { id: toastId });
        setIsProcessing(false);
        return;
      }

      setProgressLog(prev => [...prev, `Found ${mp4Files.length} MP4 videos to process.`]);

      for (let i = 0; i < mp4Files.length; i++) {
        const file = mp4Files[i];
        setProgressLog(prev => [...prev, `[${i + 1}/${mp4Files.length}] Pinging edge processor for ${file.name}...`]);

        try {
          const response = await fetch('https://vtmaffcyvhnnmfibfswm.supabase.co/functions/v1/watermark-video', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0bWFmZmN5dmhubm1maWJmc3dtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTk2Mjk1OSwiZXhwIjoyMDk3NTM4OTU5fQ.6PkTQJd6t2LLNtEqFbqCpvPQXXbrawqd2D8FjUJVZBg`
            },
            body: JSON.stringify({
              record: {
                name: file.name,
                bucket_id: 'lounge-shorts'
              }
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Edge function returned error: ${response.status} - ${errText}`);
          }

          setProgressLog(prev => [...prev, `✅ Successfully watermarked ${file.name}`]);
          setProcessedCount(c => c + 1);
        } catch (fileErr: any) {
          console.error(`Error watermarking ${file.name}:`, fileErr);
          setProgressLog(prev => [...prev, `❌ Failed to process ${file.name}: ${fileErr.message || fileErr}`]);
        }
      }

      setProgressLog(prev => [...prev, "🎉 Completed batch watermarking process!"]);
      toast.success("Batch watermarking completed!", { id: toastId });

    } catch (err: any) {
      console.error("Watermarking script failed:", err);
      setProgressLog(prev => [...prev, `🚨 Script execution failed: ${err.message || err}`]);
      toast.error(`Execution failed: ${err.message}`, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div id="admin-dashboard-container" className="w-full h-full bg-zinc-950 p-4 md:p-6 overflow-y-auto no-scrollbar text-zinc-100">
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
          VIP Escrow &amp; Lounge Admin Panel
          <span className="text-[10px] bg-pink-500/10 text-pink-400 border border-pink-500/30 px-2 py-0.5 rounded-full font-mono uppercase tracking-widest font-bold">Secure Guard</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Monitor your active bookings, verify host companion checkouts, and review secure escrow payment balances.
        </p>
      </div>

      {/* 💳 Step 2: Display the Active Card Inside the Vault Status Display */}
      <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          {currentUserProfile?.has_payment_method ? (
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-xs font-mono font-black text-white uppercase tracking-wider">Escrow Authorization Hold Verified</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Your primary payment card <span className="text-emerald-400 font-bold font-mono">{currentUserProfile.card_brand_last4 || "Card"}</span> is linked. You can secure rendezvous escrow agreements instantly.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 border border-emerald-500/20 bg-emerald-950/20 px-3 py-1 rounded-full font-bold uppercase shrink-0">
                ✓ Ready for Escrow
              </span>
            </div>
          ) : (
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl" />
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-rose-950/40 border border-rose-800/60 flex items-center justify-center text-rose-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-xs font-mono font-black text-rose-400 uppercase tracking-wider">Hold Security Required</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Link a valid payment card to establish hold credentials. Booking request escrows cannot be processed without hold coverage.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-rose-400 border border-rose-500/20 bg-rose-950/20 px-3 py-1 rounded-full font-bold uppercase shrink-0">
                ⚠️ SETUP REQUIRED
              </span>
            </div>
          )}

          {/* Render Credit Card Linkage Form underneath */}
          <div className="w-full">
            <EscrowLinkCardForm 
              currentUserId={currentUserProfile?.id || ""} 
              onCardLinkedSuccess={() => {
                if (onRefreshProfile) onRefreshProfile();
              }} 
            />
          </div>
        </div>

        {/* 📋 Step 2's Chronological Ledger Log */}
        <div className="lg:col-span-1">
          <EscrowHistoryLog currentUserId={currentUserProfile?.id || ""} />
        </div>
      </div>

      {/* Analytics bento grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">Durable Escrow Vault</span>
          <span className="text-3xl font-black text-emerald-400 font-mono">${escrowBalance}</span>
          <div className="text-[10px] text-zinc-500 mt-2 font-mono flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Held in premium custody</span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">Rendezvous Scheduled</span>
          <span className="text-3xl font-black text-white font-mono">{totalBookingsCount}</span>
          <div className="text-[10px] text-zinc-500 mt-2 font-mono">
            <span>{activeEscrowsCount} Escrowed • {completedBookings} Completed</span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 relative overflow-hidden col-span-1">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">Host Verification SLA</span>
          <span className="text-3xl font-black text-pink-500 font-mono">100%</span>
          <div className="text-[10px] text-zinc-500 mt-2 font-mono">
            <span>Biometric Scanner Certified</span>
          </div>
        </div>
      </div>

      {/* Platform & Content Utilities */}
      <div id="platform-utilities-panel" className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-pink-500" />
            <h3 className="font-extrabold text-white text-sm">Platform &amp; Content Utilities</h3>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono font-bold uppercase">System Maintenance</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Historical Watermark Batch Job</h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Bake the premium <span className="text-white font-bold">👑 LUSTY GLOBAL VIP</span> watermark directly into the video streams of all pre-existing clips in the lounge bucket.
            </p>
            <p className="text-[10px] text-zinc-500 leading-normal">
              This triggers a high-performance processing job via Supabase Edge Functions, preventing screen capture leaks.
            </p>
            <button
              id="trigger-watermark-job-btn"
              onClick={runWatermarkScript}
              disabled={isProcessing}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                isProcessing 
                  ? 'bg-zinc-850 border-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white border-pink-500/30 hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-pink-500/10'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-pink-400" />
                  Processing ({processedCount}/{totalFiles})...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Watermark Existing Videos
                </>
              )}
            </button>
          </div>

          <div className="md:col-span-2 bg-zinc-950/80 border border-zinc-850 rounded-2xl p-4 flex flex-col h-[180px]">
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-2 font-bold uppercase tracking-wider border-b border-zinc-900 pb-1.5">
              <span>System Output Log</span>
              {isProcessing && (
                <span className="text-pink-400 flex items-center gap-1 animate-pulse">
                  ● Running
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-[10px] text-zinc-400 space-y-1.5 p-1 no-scrollbar select-text">
              {progressLog.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-600 italic">
                  No job running. Click "Watermark Existing Videos" to initiate batch processing.
                </div>
              ) : (
                progressLog.map((log, idx) => (
                  <div key={idx} className={`${log.startsWith('❌') ? 'text-red-400 font-bold' : log.startsWith('✅') ? 'text-emerald-400 font-bold' : log.startsWith('🎉') ? 'text-pink-400 font-black' : 'text-zinc-400'}`}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main ledger list */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-pink-500" />
            <h3 className="font-extrabold text-white text-sm">Active Booking Ledgers</h3>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">UPDATED REAL-TIME</span>
        </div>

        {bookings.length > 0 ? (
          <div className="flex flex-col gap-3">
            {bookings.map(booking => {
              const companion = COMPANIONS.find(c => c.id === booking.companionId) || COMPANIONS[0];
              const depositAmount = Math.round(booking.rate * booking.duration * 0.3);

              return (
                <div key={booking.id} className="bg-zinc-950/80 border border-zinc-850 p-4 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img src={companion.avatar} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-pink-500" />
                    <div className="text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-white">@{companion.username}</span>
                        {companion.isVIP && (
                          <span className="inline-flex items-center justify-center text-blue-400 text-xs" title="Verified Companion">
                            ☑️
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-400 text-[11px] font-mono mt-0.5">
                        {booking.date} at {booking.time} ({booking.duration} hrs)
                      </p>
                      <p className="text-zinc-500 text-[10px] font-mono mt-1">
                        📍 {booking.location}
                      </p>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 font-mono">
                    <div className="text-right">
                      <span className="text-zinc-500 text-[10px] block">ESCROW DEPOSIT</span>
                      <span className="text-emerald-400 font-extrabold text-sm">${depositAmount}</span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      booking.status === 'escrowed' 
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {booking.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertCircle className="w-8 h-8 text-zinc-700 mb-2" />
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No Active Bookings</h4>
            <p className="text-[11px] text-zinc-500 max-w-sm mt-1">
              Once you confirm and fund booking rendezvous proposals with verified companions, your active vault contracts will display here.
            </p>
          </div>
        )}
      </div>

      {/* 🔒 Footer Section */}
      <div className="mt-[10px] pt-[10px] border-t border-zinc-900/60 flex flex-col sm:flex-row items-center justify-between gap-[10px] text-[10px] text-zinc-500 font-mono">
        <div className="flex items-center gap-[10px]">
          <ShieldAlert className="w-3.5 h-3.5 text-pink-500" />
          <span>Security Protocol: <span className="text-zinc-400">Secure Custody E2EE</span></span>
        </div>
        <div className="flex items-center gap-[10px]">
          <span>© 2026 LUSTY GLOBAL VIP Platform</span>
          <span className="h-1 w-1 bg-zinc-700 rounded-full" />
          <span>Transactions direct to multi-network bank nodes</span>
        </div>
      </div>

    </div>
  );
}
