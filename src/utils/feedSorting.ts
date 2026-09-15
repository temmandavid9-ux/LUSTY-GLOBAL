import { supabase } from '../lib/supabase';

// Fisher-Yates shuffle helper function
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Fetches video shorts with creators' verification status,
 * ensuring verified creators stay at the top (shuffled on every request),
 * followed by a shuffled mix of standard creators.
 */
export async function getDynamicVerifiedFirstFeed() {
  let videos: any[] = [];
  try {
    const { data, error } = await supabase
      .from('lounge_shorts')
      .select(`
        *,
        profiles:host_id (
          username,
          avatar_url,
          is_verified,
          has_prestige_badge
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      videos = data;
    } else {
      // Fallback query to 'videos' table if present
      const fallback = await supabase
        .from('videos')
        .select(`
          *,
          profiles (
            username,
            avatar_url,
            is_verified,
            has_prestige_badge
          )
        `)
        .order('created_at', { ascending: false });

      if (fallback.data) {
        videos = fallback.data;
      }
    }
  } catch (error) {
    console.error('Error fetching dynamic verified feed:', error);
    return [];
  }

  if (!videos || videos.length === 0) return [];

  // 1. Separate into verified vs. standard creator pools
  const verifiedVideos = videos.filter(
    (v: any) => v.profiles?.is_verified || v.profiles?.has_prestige_badge || v.stableIsVerified || v.is_verified
  );

  const standardVideos = videos.filter(
    (v: any) => !(v.profiles?.is_verified || v.profiles?.has_prestige_badge || v.stableIsVerified || v.is_verified)
  );

  // 2. Shuffle BOTH pools independently on every refresh/request
  const shuffledVerifiedVideos = shuffleArray(verifiedVideos);
  const shuffledStandardVideos = shuffleArray(standardVideos);

  // 3. Combine: Shuffled verified profiles always lead the top, followed by the shuffled standard mix
  return [...shuffledVerifiedVideos, ...shuffledStandardVideos];
}

/**
 * Utility function to sort any array of items so verified profiles stay at top (shuffled),
 * followed by standard profiles (shuffled).
 */
export function sortVerifiedFirstShuffled<T>(items: T[]): T[] {
  if (!items || items.length === 0) return [];

  const isItemVerified = (item: any) => {
    if (!item) return false;
    return Boolean(
      item.is_verified ||
      item.isVerified ||
      item.has_prestige_badge ||
      item.prestige_badge ||
      item.profiles?.is_verified ||
      item.profiles?.has_prestige_badge ||
      item.stableIsVerified
    );
  };

  const verifiedItems = items.filter(isItemVerified);
  const standardItems = items.filter(item => !isItemVerified(item));

  return [...shuffleArray(verifiedItems), ...shuffleArray(standardItems)];
}
