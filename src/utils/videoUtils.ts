export const SAMPLE_SAFETY_VIDEOS = [
  'https://vtmaffcyvhnnmfibfswm.supabase.co/storage/v1/object/public/videos/shorts/ec698e7c-3885-4d9e-81af-e91e9fa6fc97/1783632687007.mp4',
  'https://vtmaffcyvhnnmfibfswm.supabase.co/storage/v1/object/public/videos/shorts/393b5067-999e-4bde-a1bc-1a71e29fa365/1784071450957.mp4',
  'https://vtmaffcyvhnnmfibfswm.supabase.co/storage/v1/object/public/videos/shorts/0cac9f78-2a47-45f1-b4aa-f8dccdaa343d/1784080441834.mp4',
  'https://vjs.zencdn.net/v/oceans.mp4',
  'https://media.w3.org/2010/05/sintel/trailer.mp4'
];

export const RELIABLE_FALLBACK_VIDEO = SAMPLE_SAFETY_VIDEOS[0];

/**
 * Returns a clean, reliable video URL bypassing hotlink-blocked domains like mixkit.co or commondatastorage.googleapis.com
 */
export function getSafeVideoUrl(url?: string | null, fallbackIndex: number = 0): string {
  if (
    !url || 
    typeof url !== 'string' || 
    url.trim() === '' || 
    url.includes('mixkit.co') || 
    url.includes('commondatastorage.googleapis.com')
  ) {
    return SAMPLE_SAFETY_VIDEOS[Math.abs(fallbackIndex) % SAMPLE_SAFETY_VIDEOS.length];
  }
  return url;
}

