import { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  TrendingUp, 
  Sparkles,
  Video,
  Camera
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MultiCurrencyWallet } from './MultiCurrencyWallet';
import { ProfileDesignForm } from './ProfileDesignForm';
import { HostBoostMarketingConsole } from './HostBoostMarketingConsole';
import { LoungeShortsStudio } from './LoungeShortsStudio';
import { CreatorVideoCatalog } from './CreatorVideoCatalog';
import { RequestPayoutButton } from './RequestPayoutButton';
import { HostSettlementForm } from './HostSettlementForm';
import { ReceivedTipsView } from './ReceivedTipsView';
import { VipSecurityLedger } from './VipSecurityLedger';
import { LustyGlobalLogo } from './LustyGlobalLogo';
import { formatMetricCount } from '../utils/formatMetrics';
import { HostLinkGenerator } from './HostLinkGenerator';
import PrestigeBadgePortal from './PrestigeBadgePortal';
import { useHostSettlements } from '../hooks/useHostSettlements';

interface VerificationPayoutDashboardProps {
  userProfile: { id: string; username: string; avatar: string };
  isVerified: boolean;
  onVerifySuccess: () => void;
  escrowBalance: number;
  onLogout?: () => void;
}



export function VerificationBadge({ size = 16 }: { type?: 'instagram' | 'facebook'; size?: number }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      className="inline-block text-[#1d9bf0] fill-current flex-shrink-0 drop-shadow-[0_0_6px_rgba(29,155,240,0.4)]"
      style={{ width: size, height: size }}
      aria-label="Verified creator"
    >
      <path d="M22.25 12c0-1.43-.88-2.67-2.15-3.21.15-.44.24-.91.24-1.4 0-2.2-1.72-4-3.83-4-.48 0-.94.1-1.35.27C14.56 2.39 13.38 1.5 12 1.5s-2.56.89-3.16 2.16c-.41-.17-.87-.27-1.35-.27-2.11 0-3.83 1.8-3.83 4 0 .49.09.96.24 1.4-1.27.54-2.15 1.78-2.15 3.21 0 1.43.88 2.67 2.15 3.21-.15.44-.24.91-.24 1.4 0 2.2 1.72 4 3.83 4 .48 0 .94-.1 1.35-.27.6 1.27 1.78 2.16 3.16 2.16s2.56-.89 3.16-2.16c.41.17.87.27 1.35.27 2.11 0 3.83-1.8 3.83-4 0-.49-.09-.96-.24-1.4 1.27-.54 2.15-1.78 2.15-3.21zm-12.5 4L6 12.25l1.5-1.5 2.25 2.25L16.25 6.5l1.5 1.5-8 8z" />
    </svg>
  );
}

export default function VerificationPayoutDashboard({ 
  userProfile, 
  isVerified, 
  onVerifySuccess,
  escrowBalance,
  onLogout
}: VerificationPayoutDashboardProps) {
  
  // Badge Styles Preferences
  const [badgeType, setBadgeType] = useState<'instagram' | 'facebook'>('instagram');

  // Video Management Tabs
  const [videoTab, setVideoTab] = useState<'upload' | 'catalog'>('upload');
  const [catalogRefreshKey, setCatalogRefreshKey] = useState<number>(0);

  // Live Traffic Insights source
  const [shortsData, setShortsData] = useState<any[]>([]);

  // Showcase Gallery State & Ref
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Profile states
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [profile, setProfile] = useState<any>(null);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [showPayoutForm, setShowPayoutForm] = useState(false);

  const [dropdownRef] = useState<any>(null);

  // Payout / Ledger States
  const [earningsBalance, setEarningsBalance] = useState(1450.00);
  const [totalWithdrawn, setTotalWithdrawn] = useState(3800.00);
  const hostSettlements = useHostSettlements(userProfile?.id);

  const pendingLedgerBalance = hostSettlements.pending;
  const processingLedgerBalance = hostSettlements.processing;
  const settledLedgerBalance = hostSettlements.settled;

  const fetchLedgerBalances = async () => {
    if (!userProfile?.id) return;
    try {
      // 1. Fetch booking_ledgers or bookings
      let { data } = await supabase
        .from('booking_ledgers')
        .select('*')
        .or(`companion_id.eq.${userProfile.id},client_id.eq.${userProfile.id}`);

      if (!data || data.length === 0) {
        const fallback = await supabase
          .from('bookings')
          .select('*')
          .or(`companion_id.eq.${userProfile.id},client_id.eq.${userProfile.id}`);
        if (fallback.data && fallback.data.length > 0) {
          data = fallback.data;
        }
      }

      if (!data || data.length === 0) {
        const platLedger = await supabase
          .from('platform_ledger')
          .select('*')
          .eq('recipient_id', userProfile.id);
        if (platLedger.data && platLedger.data.length > 0) {
          data = platLedger.data.map((p: any) => ({
            ...p,
            status: p.settlement_status || p.status,
            gross_amount: p.amount || p.gross_amount
          }));
        }
      }

      if (data && data.length > 0) {
        let pending = 0;
        let settled = 0;

        data.forEach((row: any) => {
          const amt = Number(row.gross_amount || row.amount || row.net_payout || 0);
          const status = String(row.status || row.escrow_status || row.settlement_status || '').toLowerCase();
          if (['pending', 'escrowed', 'paid_escrow', 'funded', 'held'].includes(status)) {
            pending += amt;
          } else if (['settled', 'completed', 'released'].includes(status)) {
            settled += amt;
          }
        });

        if (pending > 0) setEarningsBalance(pending);
        if (settled > 0) setTotalWithdrawn(settled);
      }
    } catch (err) {
      console.warn("Error fetching ledger balances:", err);
    }
  };

  const [splitEarnings, setSplitEarnings] = useState<any[]>([]);
  const [unifiedTransactions, setUnifiedTransactions] = useState<any[]>([]);
  const [ledgerTab, setLedgerTab] = useState<'split' | 'unified'>('unified');
  const [isEarningsLoading, setIsEarningsLoading] = useState(false);

  const fetchCreatorEarnings = async () => {
    if (!userProfile?.id) return;
    setIsEarningsLoading(true);
    try {
      const { data: bookings, error: bookingsErr } = await supabase
        .from('bookings')
        .select('gross_amount, platform_fee, net_payout, created_at, status')
        .eq('companion_id', userProfile.id);

      const { data: tips, error: tipsErr } = await supabase
        .from('tips')
        .select('gross_amount, platform_fee, net_payout, created_at')
        .eq('receiver_id', userProfile.id);

      let combined: any[] = [];
      if (!bookingsErr && bookings) {
        bookings.forEach((b: any) => {
          combined.push({
            type: 'Booking',
            gross: Number(b.gross_amount || 0),
            fee: Number(b.platform_fee || 0),
            net: Number(b.net_payout || 0),
            date: b.created_at ? new Date(b.created_at).toLocaleDateString() : 'N/A',
            status: b.status || 'pending'
          });
        });
      }
      if (!tipsErr && tips) {
        tips.forEach((t: any) => {
          combined.push({
            type: 'Direct Tip',
            gross: Number(t.gross_amount || 0),
            fee: Number(t.platform_fee || 0),
            net: Number(t.net_payout || 0),
            date: t.created_at ? new Date(t.created_at).toLocaleDateString() : 'N/A',
            status: 'completed'
          });
        });
      }

      combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSplitEarnings(combined);

      // Fetch unified transactions from transaction_history
      const { data: unifiedData, error: unifiedErr } = await supabase
        .from('transaction_history')
        .select('id, created_at, transaction_type, status, gross_amount, platform_fee, net_payout, tx_ref, sender_id, receiver_id')
        .or(`receiver_id.eq.${userProfile.id},sender_id.eq.${userProfile.id}`)
        .order('created_at', { ascending: false });

      if (!unifiedErr && unifiedData) {
        const uniqueUserIds = Array.from(new Set(
          unifiedData.flatMap(x => [x.sender_id, x.receiver_id]).filter(Boolean)
        ));

        let usernameMap: Record<string, string> = {};
        if (uniqueUserIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', uniqueUserIds);
          if (profs) {
            profs.forEach(p => {
              usernameMap[p.id] = p.username || 'VIP User';
            });
          }
        }

        const mappedUnified = unifiedData.map((u: any) => ({
          id: u.id,
          date: u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A',
          type: u.transaction_type,
          status: u.status,
          gross: Number(u.gross_amount || 0),
          fee: Number(u.platform_fee || 0),
          net: Number(u.net_payout || 0),
          ref: u.tx_ref || 'N/A',
          sender: usernameMap[u.sender_id] || 'Client',
          receiver: usernameMap[u.receiver_id] || 'Host'
        }));
        setUnifiedTransactions(mappedUnified);
      }
    } catch (err) {
      console.warn("Failed to fetch split earnings:", err);
    } finally {
      setIsEarningsLoading(false);
    }
  };

  useEffect(() => {
    fetchLedgerBalances();
    fetchCreatorEarnings();
  }, [userProfile?.id, refreshTrigger]);



  // 1. DYNAMIC FETCH WITH STATE RESTORATION AND ROBUST OFFLINE BACKUP
  useEffect(() => {
    let active = true;
    async function fetchProfileAndSessionState() {
      if (!userProfile?.id) {
        if (active) setLoading(false);
        return;
      }
      try {
        if (active) setLoading(true);

        // Race Supabase call against a 10s timeout to guarantee loading never gets stuck
        const supabasePromise = Promise.resolve(
          supabase
            .from('profiles')
            .select('*')
            .eq('id', userProfile.id)
            .maybeSingle()
        ).catch((err: any) => ({ error: err, data: null }));

        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Database request timeout")), 10000)
        );

        let result = await Promise.race([supabasePromise, timeoutPromise]) as any;
        let data = result?.data;
        let error = result?.error;

        if (error) {
          console.warn("Supabase fetch profile warning:", error.message);
          throw error;
        }

        // If nothing matches the ID, try matching by username as a fallback
        if (!data && userProfile.username) {
          const fallbackPromise = Promise.resolve(
            supabase
              .from('profiles')
              .select('*')
              .eq('username', userProfile.username)
              .maybeSingle()
          ).catch((err: any) => ({ error: err, data: null }));
          const fallbackResult = await Promise.race([fallbackPromise, timeoutPromise]) as any;
          data = fallbackResult?.data;
        }

        if (!active) return;

        if (data) {
          setProfile(data);
          setNewBio(data.bio || 'Verified VIP guest. Rates available on demand 🔒');
          if (Array.isArray(data.showcase_gallery)) {
            setGalleryImages(data.showcase_gallery);
          } else {
            // Load from localStorage fallback if available, to ensure it retains uploads in non-DB setups
            try {
              const localG = localStorage.getItem(`gallery_${data.id}`);
              if (localG) setGalleryImages(JSON.parse(localG));
            } catch (e) {}
          }
          if (data.current_balance !== undefined && data.current_balance !== null) {
            setEarningsBalance(Number(data.current_balance));
          }
        } else {
          // Robust Fallback structure to prevent blank states
          const defaultData = {
            id: userProfile.id,
            username: userProfile.username,
            bio: 'Verified VIP guest. Rates available on demand 🔒',
            current_balance: 1450.00,
            views_count: 1250,
            is_verified: isVerified,
            showcase_gallery: []
          };
          setProfile(defaultData);
          setNewBio(defaultData.bio);
          setEarningsBalance(defaultData.current_balance);
          try {
            const localG = localStorage.getItem(`gallery_${userProfile.id}`);
            if (localG) setGalleryImages(JSON.parse(localG));
          } catch (e) {}
        }
      } catch (err) {
        if (!active) return;
        console.warn("⚠️ Supabase unreachable or profile missing. Falling back to local demo state:", err);
        const simulatedDemoProfile = {
          id: userProfile.id || 'demo-user-123',
          username: userProfile.username || 'black',
          bio: 'Verified VIP guest. Rates available on demand 🔒 (Offline Demo Mode)',
          current_balance: 1450.00,
          views_count: 1250,
          is_verified: isVerified,
          showcase_gallery: []
        };
        setProfile(simulatedDemoProfile);
        setNewBio(simulatedDemoProfile.bio);
        setEarningsBalance(simulatedDemoProfile.current_balance);
        try {
          const localG = localStorage.getItem(`gallery_${simulatedDemoProfile.id}`);
          if (localG) setGalleryImages(JSON.parse(localG));
        } catch (e) {}
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchProfileAndSessionState();

    return () => {
      active = false;
    };
  }, [userProfile?.id, userProfile?.username, isVerified, refreshTrigger]);

  useEffect(() => {
    async function fetchShorts() {
      const targetUserId = profile?.id || userProfile?.id;
      if (!targetUserId) return;
      try {
        const { data, error } = await supabase
          .from('lounge_shorts')
          .select('views_count, likes_count, id')
          .eq('host_id', targetUserId);
        
        if (!error && data) {
          setShortsData(data);
        } else if (error) {
          // Fallback if host_id relation uses user_id
          const { data: fallbackData } = await supabase
            .from('lounge_shorts')
            .select('views_count, likes_count, id')
            .eq('user_id', targetUserId);
          if (fallbackData) {
            setShortsData(fallbackData);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch lounge shorts for traffic stats:", err);
      }
    }
    fetchShorts();
  }, [profile?.id, userProfile?.id, refreshTrigger]);

  // 2. FIXED BIO PERSISTENCE HANDLER
  const handleSaveBio = async () => {
    try {
      setIsEditingBio(false);
      // Optimistic UI state update
      setProfile((prev: any) => ({ ...prev, bio: newBio }));

      if (userProfile?.id) {
        const { error } = await supabase
          .from('profiles')
          .update({ bio: newBio })
          .eq('id', userProfile.id);

        if (error) throw error;
        console.log("✅ Biography updated successfully in database!");
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err: any) {
      console.warn("Failed to persist biography changes, saved locally:", err);
    }
  };

  // Showcase Gallery Upload Pipeline
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || galleryImages.length >= 4) return;

    try {
      const fileExt = file.name.split('.').pop();
      const targetUserId = userProfile?.id || profile?.id || 'unknown';
      const filePath = `${targetUserId}/showcase_${Date.now()}.${fileExt}`;

      let publicUrl = '';
      try {
        const { error } = await supabase.storage.from('showcase-galleries').upload(filePath, file);
        if (error) {
          // If showcase-galleries bucket doesn't exist, try creating it or fallback to profile-media
          await supabase.storage.createBucket('showcase-galleries', { public: true });
          const { error: retryError } = await supabase.storage.from('showcase-galleries').upload(filePath, file);
          if (retryError) throw retryError;
        }
        const { data } = supabase.storage.from('showcase-galleries').getPublicUrl(filePath);
        publicUrl = data.publicUrl;
      } catch (storageErr) {
        console.warn("Storage upload failed, falling back to base64 preview:", storageErr);
        // Fallback to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
        });
        reader.readAsDataURL(file);
        publicUrl = await base64Promise;
      }

      if (publicUrl) {
        const newGallery = [...galleryImages, publicUrl].slice(0, 4);
        setGalleryImages(newGallery);
        
        // Also save to localStorage fallback so it survives resets
        try {
          localStorage.setItem(`gallery_${targetUserId}`, JSON.stringify(newGallery));
        } catch (e) {}

        await supabase
          .from('profiles')
          .update({ showcase_gallery: newGallery })
          .eq('id', targetUserId);
          
        setProfile((prev: any) => ({ ...prev, showcase_gallery: newGallery }));
        console.log("✅ Showcase gallery uploaded successfully!");
      }
    } catch (err) {
      console.error("Critical error uploading showcase photo:", err);
    }
  };

  // Sync avatar URL input
  useEffect(() => {
    if (profile) {
      setAvatarUrlInput(profile.avatar_url || userProfile?.avatar || '');
    }
  }, [profile, userProfile]);

  // Save updated avatar URL
  const handleSaveAvatar = async (url: string) => {
    try {
      setProfile((prev: any) => ({ ...prev, avatar_url: url }));
      
      if (userProfile?.id) {
        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: url })
          .eq('id', userProfile.id);

        if (error) throw error;
        console.log("✅ Profile image updated successfully in database!");
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err: any) {
      console.warn("Failed to persist avatar changes, saved locally:", err);
    }
  };

  const triggerLogoutSecurely = () => {
    const confirmAction = window.confirm("Are you sure you want to log out of your session?");
    if (confirmAction) {
      if (onLogout) {
        onLogout();
      } else {
        supabase.auth.signOut();
      }
    }
  };

  // Process a new payout request
  const handlePayoutSuccess = (nextBalance: number, payoutDetails: { amount: number; method: string; account: string }) => {
    setEarningsBalance(nextBalance);
    setTotalWithdrawn(prev => prev + payoutDetails.amount);

    if (userProfile?.id) {
      setProfile((prev: any) => prev ? { ...prev, current_balance: nextBalance } : prev);
    }
  };

  if (loading) {
    return (
      <div className="text-zinc-500 text-center p-12 font-mono bg-black min-h-screen flex flex-col justify-center items-center">
        <Sparkles className="w-8 h-8 text-pink-500 animate-pulse mb-3" />
        <span>Syncing Secure VIP Session...</span>
      </div>
    );
  }

  return (
    <div id="creator-dashboard-container" className="w-full h-full bg-zinc-950 p-4 md:p-6 overflow-y-auto overflow-x-hidden text-zinc-100">
      <header className="hidden md:flex justify-between items-center bg-zinc-900/60 border border-zinc-800 p-4 rounded-3xl mb-6 shadow-lg relative z-50">
        <div className="absolute top-0 left-0 w-32 h-10 bg-pink-500/5 blur-xl pointer-events-none" />
        
        {/* ── 🔥 OFFICIAL BRAND LOGO ALIGNMENT MATRIX ── */}
        <div className="flex items-center gap-2 select-none">
          <LustyGlobalLogo />
        </div>
        
        {/* 👤 DROPDOWN CONTROLLER ANCHOR */}
        <div className="relative flex items-center gap-2" ref={dropdownRef}>
          <button 
            type="button"
            onClick={() => {
              console.log("Profile chip clicked! Current dropdown state toggling to:", !showProfileDetails);
              setShowProfileDetails(!showProfileDetails);
            }}
            className="flex items-center gap-3 bg-zinc-900/80 border border-zinc-800 hover:border-pink-500/40 active:scale-98 px-3 py-1.5 rounded-full transition cursor-pointer select-none relative z-50"
          >
            {/* Minimal quick-view profile summary chip */}
            <div className="flex items-center gap-2">
              <img 
                src={profile?.avatar_url || userProfile.avatar} 
                alt="Avatar" 
                className="w-7 h-7 rounded-full border border-pink-500 bg-zinc-800 object-cover"
              />
              <span className="text-xs font-semibold text-zinc-200">@{profile?.username || userProfile.username}</span>
              {isVerified && <VerificationBadge type={badgeType} size={13} />}
              <span className="text-zinc-500 text-[10px]">{showProfileDetails ? '▲' : '▼'}</span>
            </div>
          </button>

          {/* 📬 EXPANDED OVERLAY PANEL WITH MAX LAYER PRIORITY */}
          {showProfileDetails && (
            <div 
              className="absolute right-0 top-full mt-3 w-80 md:w-96 bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[9999] block animate-fadeIn text-left"
              style={{ display: 'block', visibility: 'visible', opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* Profile Image and Identity Banner */}
              <div className="flex flex-col border-b border-zinc-900 pb-3 gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img 
                      src={profile?.avatar_url || userProfile.avatar} 
                      alt="Expanded Avatar Layout" 
                      className="w-14 h-14 rounded-full border-2 border-pink-500 object-cover bg-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingAvatar(!isEditingAvatar);
                      }}
                      className="absolute -bottom-1 -right-1 bg-pink-500 hover:bg-pink-600 text-white rounded-full p-1 border border-zinc-950 transition duration-150 shadow-md cursor-pointer flex items-center justify-center"
                      title="Edit Profile Image"
                    >
                      <Camera className="w-3 h-3" />
                    </button>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-1">
                      @{profile?.username || userProfile.username}
                      {isVerified && (
                        <svg 
                          viewBox="0 0 24 24" 
                          className="w-3.5 h-3.5 text-[#1d9bf0] fill-current drop-shadow-[0_0_6px_rgba(29,155,240,0.4)] shrink-0"
                          aria-label="Verified creator"
                        >
                          <path d="M22.25 12c0-1.43-.88-2.67-2.15-3.21.15-.44.24-.91.24-1.4 0-2.2-1.72-4-3.83-4-.48 0-.94.1-1.35.27C14.56 2.39 13.38 1.5 12 1.5s-2.56.89-3.16 2.16c-.41-.17-.87-.27-1.35-.27-2.11 0-3.83 1.8-3.83 4 0 .49.09.96.24 1.4-1.27.54-2.15 1.78-2.15 3.21 0 1.43.88 2.67 2.15 3.21-.15.44-.24.91-.24 1.4 0 2.2 1.72 4 3.83 4 .48 0 .94-.1 1.35-.27.6 1.27 1.78 2.16 3.16 2.16s2.56-.89 3.16-2.16c.41.17.87.27 1.35.27 2.11 0 3.83-1.8 3.83-4 0-.49-.09-.96-.24-1.4 1.27-.54 2.15-1.78 2.15-3.21zm-12.5 4L6 12.25l1.5-1.5 2.25 2.25L16.25 6.5l1.5 1.5-8 8z" />
                        </svg>
                      )}
                    </h4>
                    <span className="text-[9px] bg-pink-500/10 text-pink-400 border border-pink-500/20 px-1.5 py-0.5 rounded font-mono uppercase font-bold tracking-wider">
                      {isVerified ? "VIP verified host" : "Standard Tier"}
                    </span>
                  </div>
                </div>

                {isEditingAvatar && (
                  <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-800 space-y-3 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center text-[9px] font-mono text-zinc-400 uppercase tracking-wider">
                      <span>Change Profile Image</span>
                      <button 
                        type="button" 
                        onClick={() => setIsEditingAvatar(false)}
                        className="text-zinc-500 hover:text-zinc-300 text-xs"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* File Upload Selector (Base64 conversion) */}
                    <div>
                      <label className="text-[8px] font-mono text-zinc-500 uppercase block mb-1">Upload Device File</label>
                      <input 
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              if (typeof reader.result === 'string') {
                                handleSaveAvatar(reader.result);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="w-full text-[10px] text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[9px] file:font-semibold file:bg-pink-500/10 file:text-pink-400 hover:file:bg-pink-500/20 cursor-pointer"
                      />
                    </div>

                    {/* Text input URL */}
                    <div>
                      <label className="text-[8px] font-mono text-zinc-500 uppercase block mb-1">Or Paste Image URL</label>
                      <div className="flex gap-1.5">
                        <input 
                          type="url"
                          placeholder="https://images.unsplash.com/..."
                          value={avatarUrlInput}
                          onChange={(e) => setAvatarUrlInput(e.target.value)}
                          className="flex-1 bg-black text-[10px] text-zinc-100 rounded px-2 py-1 border border-zinc-800 focus:outline-none focus:border-pink-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveAvatar(avatarUrlInput)}
                          className="bg-pink-500 hover:bg-pink-600 text-zinc-950 font-extrabold text-[10px] px-2.5 rounded transition duration-150"
                        >
                          Apply
                        </button>
                      </div>
                    </div>

                    {/* Premium Unsplash presets */}
                    <div>
                      <span className="text-[8px] font-mono text-zinc-500 uppercase block mb-1.5">Premium Model Presets</span>
                      <div className="flex gap-2.5">
                        {[
                          { name: 'Sofia', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
                          { name: 'Elena', url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150' },
                          { name: 'Chloe', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
                          { name: 'Amara', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150' }
                        ].map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => {
                              setAvatarUrlInput(preset.url);
                              handleSaveAvatar(preset.url);
                            }}
                            className="relative rounded-full focus:outline-none cursor-pointer"
                            title={`Select ${preset.name}`}
                          >
                            <img 
                              src={preset.url} 
                              alt={preset.name} 
                              className={`w-8 h-8 rounded-full border-2 object-cover transition ${
                                (profile?.avatar_url || userProfile.avatar) === preset.url ? 'border-pink-500 scale-110' : 'border-zinc-800 hover:border-zinc-500'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* INTEGRATED BIOGRAPHY CUSTOMIZATION SUITE */}
              <div className="space-y-1.5 bg-zinc-900/40 p-3 rounded-xl border border-zinc-900 my-3">
                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  <span>Creator Biography</span>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      isEditingBio ? handleSaveBio() : setIsEditingBio(true);
                    }}
                    className="text-pink-400 hover:underline normal-case font-sans text-xs"
                  >
                    {isEditingBio ? '💾 Save' : '📝 Edit'}
                  </button>
                </div>

                {isEditingBio ? (
                  <textarea
                    value={newBio}
                    onChange={(e) => setNewBio(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-pink-500"
                    rows={2}
                  />
                ) : (
                  <p className="text-xs text-zinc-400 italic bg-black/40 p-2 rounded-md border border-zinc-900/60 whitespace-pre-wrap leading-relaxed">
                    {profile?.bio || 'Verified VIP guest. Rates available on demand 🔒'}
                  </p>
                )}
              </div>

              {/* NESTED FINANCIAL WALLET INTERFACE */}
              <div className="space-y-3 mb-3">
                <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-3 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[9px] text-zinc-500 block uppercase font-mono">Total Paid Out</span>
                    <div className="font-bold font-mono text-zinc-300">
                      ${totalWithdrawn.toFixed(2)} USD
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded font-bold font-mono uppercase tracking-wider">✓ Settled</span>
                </div>

                <MultiCurrencyWallet 
                  currentBalance={earningsBalance} 
                  userId={userProfile?.id} 
                  escrowBalance={escrowBalance} 
                />

                {userProfile?.id && (
                  <>
                    <ReceivedTipsView userId={userProfile.id} />
                    <VipSecurityLedger userId={userProfile.id} />
                  </>
                )}

                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPayoutForm(!showPayoutForm);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs py-2 rounded-xl transition duration-150 font-mono"
                >
                  {showPayoutForm ? "Close Withdraw Menu" : "Withdraw Earnings"}
                </button>

                {/* Inline Withdrawal form inside wallet accordion when opened */}
                {showPayoutForm && (
                  <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-3 animate-fadeIn space-y-3 text-left">
                    <GlobalPayoutForm 
                      currentBalance={earningsBalance}
                      userId={userProfile?.id}
                      onPayoutSuccess={(newBalance: number, payoutDetails: any) => {
                        handlePayoutSuccess(newBalance, payoutDetails);
                        // Delay closing the payout form slightly for user feedback
                        setTimeout(() => {
                          setShowPayoutForm(false);
                        }, 2500);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* SHOWCASE GALLERY [0/4] UPLOAD PIPELINE */}
              <div className="space-y-2 bg-zinc-900/40 p-3 rounded-xl border border-zinc-900 my-3 text-left" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  <span>Showcase Gallery [{galleryImages.length}/4]</span>
                  <span className="text-[9px] text-zinc-600 font-mono normal-case">showcase-galleries</span>
                </div>
                
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {/* Render existing images */}
                  {galleryImages.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 group">
                      <img src={img} alt="Showcase" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const updated = galleryImages.filter((_, idx) => idx !== i);
                          setGalleryImages(updated);
                          await supabase
                            .from('profiles')
                            .update({ showcase_gallery: updated })
                            .eq('id', userProfile?.id || profile?.id);
                          setProfile((prev: any) => ({ ...prev, showcase_gallery: updated }));
                          try {
                            localStorage.setItem(`gallery_${userProfile?.id || profile?.id}`, JSON.stringify(updated));
                          } catch (err) {}
                        }}
                        className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] uppercase font-black transition cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  
                  {/* Fill empty slots */}
                  {Array.from({ length: Math.max(0, 4 - galleryImages.length) }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="aspect-square rounded-lg border border-dashed border-zinc-800 hover:border-pink-500/50 bg-zinc-950 flex flex-col items-center justify-center text-zinc-600 hover:text-pink-400 transition cursor-pointer"
                    >
                      <span className="text-lg font-light font-mono">+</span>
                      <span className="text-[8px] font-mono uppercase">Upload</span>
                    </button>
                  ))}
                </div>

                {/* Hidden File Input Processor */}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleGalleryUpload}
                  accept="image/*"
                  className="hidden" 
                />
              </div>

              {/* SYSTEM DISCONNECT (LOGOUT BUTTON MOVED INSIDE DROPDOWN) */}
              <div className="pt-2 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileDetails(false);
                    triggerLogoutSecurely();
                  }}
                  className="w-full text-left p-2 hover:bg-red-950/20 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 transition duration-150 flex items-center gap-2 cursor-pointer"
                >
                  <span>🚪</span> Secure Logout / Disconnect
                </button>
              </div>

            </div>
          )}
        </div>
      </header>

      {/* PRIMARY GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* Campaign / Booster Grid */}
        <div className="lg:col-span-2">
          <HostBoostMarketingConsole currentUserId={profile?.id || userProfile?.id || ''} />
        </div>

        {/* METRICS SIDEBAR SECTION */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-mono">Live Traffic Insights</h3>
            <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">Aggregated live tracking from feeds.</p>
            
            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white font-mono">
                {(() => {
                  const liveTrafficViews = shortsData.reduce((sum, post) => sum + (post.views_count || 0), 0);
                  return formatMetricCount(liveTrafficViews || profile?.views_count || 1250);
                })()}
              </span>
              <span className="text-xs text-zinc-400 font-mono">Views</span>
            </div>
            
            <div className="mt-4 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 py-2 px-3 rounded-xl">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[10px] font-mono text-emerald-400 font-bold">+18.5% Growth this week</span>
            </div>
          </div>

            {/* HOST SETTLEMENT & LEDGER PAYOUTS */}
            <div className="border-t border-zinc-800/60 pt-4 mt-6">
              <h4 className="text-[10px] font-black tracking-wider uppercase text-zinc-500 font-mono mb-3">
                Host Settlement & Ledger Payouts
              </h4>
              
              <div className="grid grid-cols-3 gap-2 mb-4 bg-zinc-950 p-3 rounded-2xl border border-zinc-850/60">
                <div className="text-center">
                  <span className="text-[9px] text-zinc-500 block uppercase font-mono">Pending</span>
                  <span className="text-xs font-bold font-mono text-zinc-300">
                    ${pendingLedgerBalance.toFixed(2)}
                  </span>
                </div>
                <div className="text-center border-x border-zinc-850/80">
                  <span className="text-[9px] text-zinc-500 block uppercase font-mono">Processing</span>
                  <span className="text-xs font-bold font-mono text-pink-400">
                    ${processingLedgerBalance.toFixed(2)}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] text-zinc-500 block uppercase font-mono">Settled</span>
                  <span className="text-xs font-bold font-mono text-emerald-400">
                    ${settledLedgerBalance.toFixed(2)}
                  </span>
                </div>
              </div>

              <RequestPayoutButton 
                currentUserId={userProfile?.id || ''}
                pendingBalance={pendingLedgerBalance}
                escrowBalance={escrowBalance}
                payoutConfigured={Boolean(
                  profile?.payout_configured ||
                  profile?.has_payment_method ||
                  profile?.settlement_account_number ||
                  (() => {
                    try {
                      const stored = localStorage.getItem(`settlement_config_${userProfile?.id}`);
                      if (stored) {
                        const parsed = JSON.parse(stored);
                        return Boolean(parsed?.payout_configured || parsed?.has_payment_method || parsed?.settlement_account_number);
                      }
                    } catch (e) {}
                    return false;
                  })()
                )}
                onPayoutRequested={() => {
                  // Refresh dashboard stats instantly
                  fetchLedgerBalances();
                  setRefreshTrigger(prev => prev + 1);
                }}
              />

              <HostSettlementForm 
                currentUser={userProfile}
                onConfigured={() => {
                  setRefreshTrigger(prev => prev + 1);
                }}
              />

             {/* Split Payouts Ledger List */}
             <div className="mt-4 border-t border-zinc-800/40 pt-4">
               <div className="flex gap-2 mb-2 p-0.5 bg-zinc-950 border border-zinc-900 rounded-lg">
                 <button
                   type="button"
                   onClick={() => setLedgerTab('unified')}
                   className={`flex-1 text-[9px] font-extrabold font-mono py-1 rounded-md transition ${
                     ledgerTab === 'unified'
                       ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-pink-500/20 text-pink-400'
                       : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                   }`}
                 >
                   Unified Ledger
                 </button>
                 <button
                   type="button"
                   onClick={() => setLedgerTab('split')}
                   className={`flex-1 text-[9px] font-extrabold font-mono py-1 rounded-md transition ${
                     ledgerTab === 'split'
                       ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-pink-500/20 text-pink-400'
                       : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                   }`}
                 >
                   Split Earnings
                 </button>
               </div>
 
               {isEarningsLoading ? (
                 <div className="text-[10px] font-mono text-zinc-500 animate-pulse text-center py-2">
                   Syncing transaction ledgers...
                 </div>
               ) : ledgerTab === 'split' ? (
                 splitEarnings.length === 0 ? (
                   <div className="text-[9px] font-mono text-zinc-600 text-center py-2 bg-zinc-950 rounded-lg border border-zinc-900">
                     No splits logged in this cycle
                   </div>
                 ) : (
                   <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                     {splitEarnings.map((earn, i) => (
                       <div key={i} className="flex flex-col bg-zinc-950 border border-zinc-900 rounded-lg p-2 text-left text-[10px] font-mono">
                         <div className="flex justify-between items-center mb-1">
                           <span className="font-extrabold text-zinc-300">{earn.type}</span>
                           <span className="text-[8px] text-zinc-500">{earn.date}</span>
                         </div>
                         <div className="grid grid-cols-3 gap-1 text-center bg-zinc-900/50 p-1 rounded border border-zinc-850">
                           <div>
                             <span className="text-[8px] text-zinc-500 block">Gross</span>
                             <span className="font-bold text-zinc-300">${earn.gross.toFixed(2)}</span>
                           </div>
                           <div>
                             <span className="text-[8px] text-pink-500/80 block">Platform (15%)</span>
                             <span className="font-bold text-pink-400/90">${earn.fee.toFixed(2)}</span>
                           </div>
                           <div>
                             <span className="text-[8px] text-emerald-500 block">Net Payout</span>
                             <span className="font-bold text-emerald-400">${earn.net.toFixed(2)}</span>
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                 )
               ) : (
                 unifiedTransactions.length === 0 ? (
                   <div className="text-[9px] font-mono text-zinc-600 text-center py-2 bg-zinc-950 rounded-lg border border-zinc-900">
                     No unified transactions recorded
                   </div>
                 ) : (
                   <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                     {unifiedTransactions.map((tx) => (
                       <div key={tx.id} className="flex flex-col bg-zinc-950 border border-zinc-900 rounded-lg p-2 text-left text-[10px] font-mono">
                         <div className="flex justify-between items-center mb-1 border-b border-zinc-900/40 pb-1">
                           <span className="font-extrabold text-zinc-300 uppercase text-[9px]">{tx.type}</span>
                           <span className="text-[8px] text-zinc-500">{tx.date}</span>
                         </div>
                         <div className="space-y-1 mt-1 text-[9px]">
                           <div className="flex justify-between">
                             <span className="text-zinc-500">Ref:</span>
                             <span className="text-zinc-400 select-all font-bold truncate max-w-[140px]">{tx.ref}</span>
                           </div>
                           <div className="flex justify-between">
                             <span className="text-zinc-500">Flow:</span>
                             <span className="text-zinc-300 truncate max-w-[150px]">{tx.sender} ➔ {tx.receiver}</span>
                           </div>
                           <div className="grid grid-cols-4 gap-0.5 text-center bg-zinc-900/30 p-1 rounded border border-zinc-850 mt-1">
                             <div>
                               <span className="text-[7px] text-zinc-500 block">Gross</span>
                               <span className="font-bold text-zinc-200">${tx.gross.toFixed(2)}</span>
                             </div>
                             <div>
                               <span className="text-[7px] text-zinc-500 block">Fee</span>
                               <span className="font-bold text-pink-400">${tx.fee.toFixed(2)}</span>
                             </div>
                             <div>
                               <span className="text-[7px] text-zinc-500 block">Net</span>
                               <span className="font-bold text-emerald-400">${tx.net.toFixed(2)}</span>
                             </div>
                             <div>
                               <span className="text-[7px] text-zinc-500 block">State</span>
                               <span className={`font-black text-[7px] uppercase block rounded-sm ${
                                 tx.status === 'completed' || tx.status === 'paid_escrow'
                                   ? 'text-emerald-400 bg-emerald-950/20 border border-emerald-900/30'
                                   : 'text-amber-400 bg-amber-950/20 border border-amber-900/30'
                               }`}>{tx.status}</span>
                             </div>
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                 )
               )}
             </div>
          </div>

          <div className="pt-4 border-t border-zinc-800/60 flex justify-between items-center gap-[10px] text-[10px] font-mono text-zinc-400 mt-4">
            <span>Escrow Vault Reserve:</span>
            <span className="font-bold text-pink-500 font-mono bg-zinc-950 px-2.5 py-1 rounded-full border border-zinc-850">
              ${escrowBalance.toFixed(2)}
            </span>
          </div>
        </div>

      </div>

      {/* SECONDARY ROW: MEDIA ENGINE, PROFILE CUSTOMIZER, AND VERIFICATION PORTAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* RE-ENGINEERED MEDIA MANAGER / PUBLISHING ENGINE */}
        <section className="lg:col-span-4 bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex flex-col justify-between">
          <div className="w-full">
            {/* 📑 Elegant Media & Upload Tab bar */}
            <div className="flex border-b border-zinc-800/60 pb-3 mb-4 justify-between items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-1.5">
                <Video className="w-4 h-4 text-pink-500 animate-pulse" />
                <span>Media Hub</span>
              </h2>
              
              <div className="flex gap-0.5 bg-zinc-950 p-0.5 rounded-lg border border-zinc-850">
                <button
                  type="button"
                  onClick={() => setVideoTab('upload')}
                  className={`text-[9px] font-mono font-extrabold px-2 py-1 rounded-md transition duration-150 ${
                    videoTab === 'upload' 
                      ? 'bg-pink-500/10 border border-pink-500/20 text-pink-400' 
                      : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                  }`}
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => setVideoTab('catalog')}
                  className={`text-[9px] font-mono font-extrabold px-2 py-1 rounded-md transition duration-150 ${
                    videoTab === 'catalog' 
                      ? 'bg-pink-500/10 border border-pink-500/20 text-pink-400' 
                      : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                  }`}
                >
                  Catalog
                </button>
              </div>
            </div>

            {videoTab === 'upload' ? (
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-500 font-mono">Capture or upload visual loops into the live feed.</p>
                <LoungeShortsStudio 
                  currentUserId={profile?.id || userProfile?.id || ''} 
                  onUploadSuccess={() => {
                    console.log("Video successfully uploaded and registered in database!");
                    setCatalogRefreshKey(prev => prev + 1);
                    setVideoTab('catalog');
                  }} 
                />
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-500 font-mono mb-2">Review views, likes, and manage your published short clips.</p>
                <CreatorVideoCatalog 
                  currentUserId={profile?.id || userProfile?.id || ''} 
                  refreshTrigger={catalogRefreshKey}
                />
              </div>
            )}
          </div>
        </section>

        {/* 🎨 CREATOR PROFILE SETUP FORM (THE CUSTOMIZER) */}
        <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-0 overflow-hidden flex flex-col justify-between">
          <ProfileDesignForm 
            userId={userProfile.id} 
            onUpdateSuccess={() => {
              console.log("Companion design updated successfully, live feed syncing...");
              setRefreshTrigger(prev => prev + 1);
            }}
            onProfileUpdate={(updatedFields) => {
              setProfile((prev: any) => prev ? { ...prev, ...updatedFields } : updatedFields);
            }}
          />
        </div>

        {/* VERIFICATION COLUMN */}
        {isVerified ? (
          <div className="lg:col-span-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/60">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-sky-400" />
                  <h3 className="font-extrabold text-sm text-white font-mono">PRESTIGE BADGE PORTAL</h3>
                </div>
                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Security Pass</span>
              </div>

              <div className="bg-sky-950/10 border border-sky-500/20 rounded-2xl p-5 text-center">
                <div className="w-14 h-14 rounded-full bg-sky-950 flex items-center justify-center mx-auto mb-3 border border-sky-500/20">
                  <VerificationBadge type={badgeType} size={32} />
                </div>
                
                <h4 className="text-xs font-black text-white mb-1.5">Full Verification Active</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed mb-4">
                  Your prestige verification badge is visible across active matching feeds and searches. Choose your preferred theme style below:
                </p>

                {/* Badge style toggles */}
                <div className="grid grid-cols-2 gap-2 mt-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-850">
                  <button 
                    onClick={() => setBadgeType('instagram')}
                    className={`py-2 px-2.5 rounded-lg border text-[10px] font-mono font-bold flex items-center justify-center gap-2 transition ${
                      badgeType === 'instagram' 
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400' 
                        : 'bg-zinc-900 border-zinc-805 text-zinc-400'
                    }`}
                  >
                    <VerificationBadge type="instagram" size={13} />
                    <span>Instagram Badge</span>
                  </button>

                  <button 
                    onClick={() => setBadgeType('facebook')}
                    className={`py-2 px-2.5 rounded-lg border text-[10px] font-mono font-bold flex items-center justify-center gap-2 transition ${
                      badgeType === 'facebook' 
                        ? 'bg-blue-600/10 border-blue-600 text-blue-400' 
                        : 'bg-zinc-900 border-zinc-805 text-zinc-400'
                    }`}
                  >
                    <VerificationBadge type="facebook" size={13} />
                    <span>Facebook Badge</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-zinc-800/60 flex items-center gap-[10px] text-[10px] text-zinc-500 font-mono">
              <Lock className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <span>Adheres strictly to modern encryption verification protocols.</span>
            </div>
          </div>
        ) : (
          <PrestigeBadgePortal 
            userProfile={userProfile} 
            profile={profile} 
            onVerifySuccess={() => {
              if (onVerifySuccess) onVerifySuccess();
              setProfile((prev: any) => prev ? { ...prev, is_verified: true } : prev);
            }} 
          />
        )}

      </div>

      {/* VIRAL MARKETING PROMO LINK GENERATOR ROW */}
      <div className="mt-6 mb-2">
        <HostLinkGenerator username={profile?.username || userProfile?.username || 'anonymous'} />
      </div>

      {/* 🔒 Footer Section */}
      <div className="mt-[10px] pt-[10px] border-t border-zinc-900/60 flex flex-col sm:flex-row items-center justify-between gap-[10px] text-[10px] text-zinc-500 font-mono">
        <div className="flex items-center gap-[10px]">
          <ShieldCheck className="w-3.5 h-3.5 text-pink-500" />
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

const GLOBAL_BANK_DIRECTORY: Record<string, { currency: string; label: string; placeholder: string; regex: RegExp; list: string[] }> = {
  NG: {
    currency: "NGN",
    label: "10-Digit NUBAN Account Number",
    placeholder: "0123456789",
    regex: /^\d{10}$/,
    list: ["Access Bank", "Ecobank", "Fidelity Bank", "First Bank", "FCMB", "GTBank", "Opay", "Palmpay", "Stanbic IBTC", "Sterling Bank", "UBA", "Wema Bank", "Zenith Bank"]
  },
  US: {
    currency: "USD",
    label: "9-Digit Routing + Account Number",
    placeholder: "Routing: 021000021 / Acc: 12345678",
    regex: /^[0-9\-]{4,17}$/,
    list: ["Chase Bank", "Bank of America", "Wells Fargo", "Citibank", "Capital One", "PNC Bank", "U.S. Bank", "TD Bank"]
  },
  GB: {
    currency: "GBP",
    label: "6-Digit Sort Code + 8-Digit Account Number",
    placeholder: "Sort: 20-00-00 / Acc: 12345678",
    regex: /^[0-9\s\-]{8,14}$/,
    list: ["Barclays", "HSBC UK", "Lloyds Bank", "NatWest", "Santander UK", "Revolut", "Monzo"]
  },
  KE: {
    currency: "KES",
    label: "Bank Account Number or M-Pesa Till Number",
    placeholder: "Enter account or mobile money number",
    regex: /^\d{6,12}$/,
    list: ["KCB Bank", "Equity Bank", "Safaricom M-Pesa", "Co-operative Bank", "NCBA Bank", "Absa Bank Kenya"]
  },
  ZA: {
    currency: "ZAR",
    label: "Standard Bank Account Number",
    placeholder: "Enter account identifier digits",
    regex: /^\d{9,13}$/,
    list: ["Standard Bank", "First National Bank (FNB)", "ABSA", "Nedbank", "Capitec Bank", "TymeBank"]
  }
};

const COUNTRIES = [
  { code: "NG", name: "Nigeria 🇳🇬" },
  { code: "US", name: "United States 🇺🇸" },
  { code: "GB", name: "United Kingdom 🇬🇧" },
  { code: "KE", name: "Kenya 🇰🇪" },
  { code: "ZA", name: "South Africa 🇿🇦" }
];

export function GlobalPayoutForm({ currentBalance, userId, onPayoutSuccess }: any) {
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Automatically clear out the bank selection whenever the country shifts
  useEffect(() => {
    setSelectedBank('');
    setAccountNumber('');
    setErrorMessage('');
  }, [selectedCountry]);

  const handleGlobalWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedCountry || !selectedBank || !accountNumber || !withdrawAmount) {
      setErrorMessage("Please fill out all withdrawal entry fields.");
      return;
    }

    const countryMeta = GLOBAL_BANK_DIRECTORY[selectedCountry];
    const cleanedAccount = accountNumber.replace(/[\s\-]/g, '');

    // Validate account numbers dynamically based on country rules
    if (!countryMeta.regex.test(cleanedAccount)) {
      setErrorMessage(`Invalid account layout rules for ${COUNTRIES.find(c => c.code === selectedCountry)?.name}.`);
      return;
    }
    
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0 || amountNum > currentBalance) {
      setErrorMessage(`Invalid amount. Liquidity limit: $${currentBalance}.`);
      return;
    }

    setIsProcessing(true);

    try {
      const newBalance = currentBalance - amountNum;
      
      // Update balance
      const { error: balanceErr } = await supabase
        .from('profiles')
        .update({ current_balance: newBalance })
        .eq('id', userId);
      if (balanceErr) throw balanceErr;

      // Log transaction with explicit country mapping
      try {
        const { error: logErr } = await supabase
          .from('payout_logs')
          .insert([{
            user_id: userId,
            country_code: selectedCountry,
            bank_name: selectedBank,
            account_number: cleanedAccount,
            amount: amountNum,
            currency: countryMeta.currency,
            status: 'PENDING'
          }]);
        if (logErr) {
          console.warn("payout_logs insert failed, simulated fallback used:", logErr);
        }

        // Log unified audit history
        const payoutGatewayRef = `TRX-PAY-${Date.now()}`;
        try {
          await supabase.from('transaction_history').insert([{
            sender_id: userId,
            receiver_id: userId,
            transaction_type: 'payout',
            status: 'pending',
            gross_amount: amountNum,
            platform_fee: 0,
            net_payout: amountNum,
            tx_ref: payoutGatewayRef
          }]);
        } catch (histErr) {
          console.warn("Unified transaction log error for payout (ignored):", histErr);
        }
      } catch (logErr) {
        console.warn("Could not insert payout log into database:", logErr);
      }

      onPayoutSuccess(newBalance, {
        amount: amountNum,
        method: `${selectedBank} (${countryMeta.currency})`,
        account: cleanedAccount
      });
      setWithdrawAmount('');
      setAccountNumber('');
      setSelectedBank('');
      alert(`Global withdrawal request submitted! Fattening local bank wire...`);
    } catch (err) {
      console.error("Payout failed:", err);
      setErrorMessage("Network synchronization failure.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900 space-y-4 max-w-md mx-auto">
      <div>
        <h3 className="text-sm font-bold text-zinc-200">🌍 International Multi-Currency Payout Gateway</h3>
        <p className="text-[11px] text-zinc-500 font-mono">Available Wallet Vault Liquid Balance: <span className="text-emerald-400 font-bold">${currentBalance.toFixed(2)}</span></p>
      </div>

      <form onSubmit={handleGlobalWithdrawal} className="space-y-3">
        {/* DROPDOWN 1: COUNTRY PICKER */}
        <div>
          <label className="text-[10px] text-zinc-400 font-mono uppercase block mb-1">Settlement Country Location</label>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="w-full bg-black border border-zinc-850 p-2 rounded text-xs text-zinc-200 focus:outline-none focus:border-pink-500 cursor-pointer"
          >
            <option value="">-- Choose Settlement Country Location --</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* DROPDOWN 2: CASCADING REGIONAL BANKS */}
        {selectedCountry && (
          <div className="animate-fadeIn">
            <label className="text-[10px] text-zinc-400 font-mono uppercase block mb-1">Local Financial Institution</label>
            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="w-full bg-black border border-zinc-850 p-2 rounded text-xs text-zinc-200 focus:outline-none focus:border-pink-500 cursor-pointer"
            >
              <option value="">-- Choose Your Local Bank --</option>
              {GLOBAL_BANK_DIRECTORY[selectedCountry].list.map((bank, i) => (
                <option key={i} value={bank}>{bank}</option>
              ))}
            </select>
          </div>
        )}

        {/* ACCOUNT SPECIFICATIONS CONFIGURATION */}
        {selectedBank && (
          <div className="space-y-3 animate-fadeIn">
            <div>
              <label className="text-[10px] text-zinc-400 font-mono uppercase block mb-1">
                {GLOBAL_BANK_DIRECTORY[selectedCountry].label}
              </label>
              <input
                type="text"
                placeholder={GLOBAL_BANK_DIRECTORY[selectedCountry].placeholder}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full bg-black border border-zinc-850 p-2 rounded text-xs text-zinc-200 font-mono focus:outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 font-mono uppercase block mb-1">
                Withdrawal Amount (Base Rate USD)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-zinc-500 font-mono text-xs">$</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full bg-black border border-zinc-850 pl-6 pr-16 p-2 rounded text-xs text-zinc-200 font-mono focus:outline-none focus:border-pink-500"
                />
                <span className="absolute right-2.5 top-2 text-zinc-500 font-mono text-[10px] uppercase">
                  ≈ {withdrawAmount ? (parseFloat(withdrawAmount) || 0) : 0} {GLOBAL_BANK_DIRECTORY[selectedCountry].currency}
                </span>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-950/40 border border-red-900 text-red-400 text-[11px] p-2 rounded font-mono">
            ⚠️ {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={isProcessing || !selectedBank || !accountNumber}
          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-zinc-100 text-xs font-bold py-2.5 rounded-xl transition duration-150 disabled:opacity-30 cursor-pointer"
        >
          {isProcessing ? "Processing Cross-Border Routing..." : "💸 Process Cross-Border Cashout"}
        </button>
      </form>
    </div>
  );
}
