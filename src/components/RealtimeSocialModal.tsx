import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface SocialUserProfile {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  isFollowingBack?: boolean;
  isFollowing?: boolean;
  isOnline?: boolean;
  connectedSince?: string;
}

interface RealtimeSocialModalProps {
  currentUserId: string;
  targetUserId?: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenChat?: (userId: string) => void;
  defaultTab?: 'fans' | 'following' | 'friends';
}

export const RealtimeSocialModal: React.FC<RealtimeSocialModalProps> = ({
  currentUserId,
  targetUserId,
  isOpen,
  onClose,
  onOpenChat,
  defaultTab = 'fans'
}) => {
  const effectiveUserId = targetUserId || currentUserId;
  const [activeTab, setActiveTab] = useState<'fans' | 'following' | 'friends'>(defaultTab);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [fans, setFans] = useState<SocialUserProfile[]>([]);
  const [following, setFollowing] = useState<SocialUserProfile[]>([]);
  const [friends, setFriends] = useState<SocialUserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch live social data from Supabase whenever effectiveUserId or isOpen changes
  useEffect(() => {
    if (!isOpen || !effectiveUserId) return;

    let isMounted = true;

    const fetchSocialData = async () => {
      setLoading(true);

      try {
        // 1. Fetch Fans (Users following effectiveUserId)
        let mappedFans: SocialUserProfile[] = [];
        const { data: fansData } = await supabase
          .from('user_followers')
          .select('follower_id')
          .eq('following_id', effectiveUserId);

        if (fansData && fansData.length > 0) {
          const followerIds = fansData.map((f: any) => f.follower_id).filter(Boolean);
          if (followerIds.length > 0) {
            const { data: fanProfiles } = await supabase
              .from('profiles')
              .select('id, username, full_name, avatar_url')
              .in('id', followerIds);

            // Check if current user is following back each fan
            let myFollowingSet = new Set<string>();
            if (currentUserId) {
              const { data: myFollowingData } = await supabase
                .from('user_followers')
                .select('following_id')
                .eq('follower_id', currentUserId);
              if (myFollowingData) {
                myFollowingData.forEach((row: any) => myFollowingSet.add(row.following_id));
              }
            }

            if (fanProfiles) {
              mappedFans = fanProfiles.map((p: any) => ({
                id: p.id,
                name: p.full_name || p.username || 'Fan User',
                handle: `@${p.username || 'user'}`,
                avatar: p.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                isFollowingBack: myFollowingSet.has(p.id)
              }));
            }
          }
        }

        // 2. Fetch Following (Users effectiveUserId follows)
        let mappedFollowing: SocialUserProfile[] = [];
        const { data: followingData } = await supabase
          .from('user_followers')
          .select('following_id')
          .eq('follower_id', effectiveUserId);

        if (followingData && followingData.length > 0) {
          const followingIds = followingData.map((f: any) => f.following_id).filter(Boolean);
          if (followingIds.length > 0) {
            const { data: followingProfiles } = await supabase
              .from('profiles')
              .select('id, username, full_name, avatar_url')
              .in('id', followingIds);

            if (followingProfiles) {
              mappedFollowing = followingProfiles.map((p: any) => ({
                id: p.id,
                name: p.full_name || p.username || 'Followed User',
                handle: `@${p.username || 'user'}`,
                avatar: p.avatar_url || 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
                isFollowing: true
              }));
            }
          }
        }

        // 3. Fetch Friends (Accepted connections)
        let mappedFriends: SocialUserProfile[] = [];
        const { data: connectionsData } = await supabase
          .from('connections')
          .select('requester_id, addressee_id, status')
          .or(`requester_id.eq.${effectiveUserId},addressee_id.eq.${effectiveUserId}`)
          .eq('status', 'accepted');

        if (connectionsData && connectionsData.length > 0) {
          const friendIds = connectionsData
            .map((c: any) => (c.requester_id === effectiveUserId ? c.addressee_id : c.requester_id))
            .filter(Boolean);

          if (friendIds.length > 0) {
            const { data: friendProfiles } = await supabase
              .from('profiles')
              .select('id, username, full_name, avatar_url')
              .in('id', friendIds);

            if (friendProfiles) {
              mappedFriends = friendProfiles.map((p: any) => ({
                id: p.id,
                name: p.full_name || p.username || 'Friend',
                handle: `@${p.username || 'user'}`,
                avatar: p.avatar_url || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
                isOnline: true,
                connectedSince: 'Connected'
              }));
            }
          }
        } else {
          // Fallback calculation: Mutual followers (users who follow effectiveUserId AND effectiveUserId follows back)
          const fanIds = new Set(mappedFans.map(f => f.id));
          const mutuals = mappedFollowing.filter(f => fanIds.has(f.id));
          mappedFriends = mutuals.map(p => ({
            id: p.id,
            name: p.name,
            handle: p.handle,
            avatar: p.avatar,
            isOnline: true,
            connectedSince: 'Connected'
          }));
        }

        if (isMounted) {
          setFans(mappedFans);
          setFollowing(mappedFollowing);
          setFriends(mappedFriends);
        }
      } catch (err) {
        console.warn("Failed to fetch social data from Supabase:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSocialData();

    return () => {
      isMounted = false;
    };
  }, [effectiveUserId, isOpen, currentUserId]);

  if (!isOpen) return null;

  // Toggle follow / unfollow on Supabase
  const handleToggleFollow = async (user: SocialUserProfile, listType: 'fans' | 'following') => {
    if (!currentUserId) return;

    if (listType === 'fans') {
      const willFollow = !user.isFollowingBack;
      setFans(prev => prev.map(u => u.id === user.id ? { ...u, isFollowingBack: willFollow } : u));

      try {
        if (willFollow) {
          await supabase
            .from('user_followers')
            .insert([{ follower_id: currentUserId, following_id: user.id }]);
        } else {
          await supabase
            .from('user_followers')
            .delete()
            .eq('follower_id', currentUserId)
            .eq('following_id', user.id);
        }
      } catch (err) {
        console.error("Error toggling follow back:", err);
      }
    } else if (listType === 'following') {
      const willFollow = !user.isFollowing;
      setFollowing(prev => prev.map(u => u.id === user.id ? { ...u, isFollowing: willFollow } : u));

      try {
        if (willFollow) {
          await supabase
            .from('user_followers')
            .insert([{ follower_id: currentUserId, following_id: user.id }]);
        } else {
          await supabase
            .from('user_followers')
            .delete()
            .eq('follower_id', currentUserId)
            .eq('following_id', user.id);
        }
      } catch (err) {
        console.error("Error toggling follow:", err);
      }
    }
  };

  // Remove connection on Supabase
  const handleRemoveConnection = async (friendId: string) => {
    setFriends(prev => prev.filter(f => f.id !== friendId));
    if (!currentUserId) return;

    try {
      await supabase
        .from('connections')
        .delete()
        .or(`and(requester_id.eq.${currentUserId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${currentUserId})`);
    } catch (err) {
      console.error("Error removing connection:", err);
    }
  };

  const currentList = activeTab === 'fans' ? fans : activeTab === 'following' ? following : friends;

  const filteredList = currentList.filter(
    u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         u.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-zinc-900 text-white rounded-2xl w-full max-w-sm flex flex-col relative shadow-2xl border border-zinc-800 overflow-hidden min-h-[420px]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-zinc-800 bg-zinc-950/80">
          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
            Social Network
          </span>
          <button 
            onClick={onClose} 
            className="w-6 h-6 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation with Live Counts */}
        <div className="flex border-b border-zinc-800 bg-zinc-950">
          <button
            onClick={() => setActiveTab('fans')}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer text-center ${
              activeTab === 'fans' ? 'border-pink-500 text-pink-500' : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Fans ({fans.length})
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer text-center ${
              activeTab === 'following' ? 'border-sky-400 text-sky-400' : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Following ({following.length})
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer text-center ${
              activeTab === 'friends' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            Friends ({friends.length})
          </button>
        </div>

        {/* Search Input Filter */}
        <div className="p-2.5 border-b border-zinc-800 bg-zinc-950/40">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700/60 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 transition"
          />
        </div>

        {/* Dynamic User List Container */}
        <div className="p-3 flex-1 overflow-y-auto max-h-72 divide-y divide-zinc-800/50">
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
              <span className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></span>
              <span>Loading real-time data...</span>
            </div>
          ) : filteredList.length > 0 ? (
            filteredList.map((user) => (
              <div key={user.id} className="flex items-center justify-between py-2.5 px-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover border border-zinc-800" />
                    {activeTab === 'friends' && (
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-zinc-950 ${user.isOnline ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-tight text-white truncate">{user.name}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{user.handle}</p>
                  </div>
                </div>

                {/* Dynamic Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {activeTab === 'fans' && (
                    <button
                      onClick={() => handleToggleFollow(user, 'fans')}
                      className={`text-[10px] px-3 py-1 rounded-full font-bold transition cursor-pointer ${
                        user.isFollowingBack
                          ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
                          : 'bg-pink-600 hover:bg-pink-500 text-white shadow'
                      }`}
                    >
                      {user.isFollowingBack ? 'Following' : 'Follow Back'}
                    </button>
                  )}

                  {activeTab === 'following' && (
                    <button
                      onClick={() => handleToggleFollow(user, 'following')}
                      className={`text-[10px] px-3 py-1 rounded-full font-bold transition cursor-pointer ${
                        user.isFollowing
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                          : 'bg-sky-600 hover:bg-sky-500 text-white shadow'
                      }`}
                    >
                      {user.isFollowing ? 'Unfollow' : 'Follow'}
                    </button>
                  )}

                  {activeTab === 'friends' && (
                    <>
                      <button
                        onClick={() => {
                          onClose();
                          if (onOpenChat) onOpenChat(user.id);
                        }}
                        className="bg-pink-600 hover:bg-pink-500 text-white text-[10px] px-2.5 py-1 rounded-lg font-bold transition shadow cursor-pointer"
                      >
                        Message
                      </button>
                      <button
                        onClick={() => handleRemoveConnection(user.id)}
                        title="Remove Connection"
                        className="bg-zinc-800 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 text-[10px] px-1.5 py-1 rounded-lg border border-zinc-700 transition cursor-pointer"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-10 text-center text-xs text-zinc-500 font-mono">
              No users found.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
