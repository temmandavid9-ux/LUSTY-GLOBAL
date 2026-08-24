import { supabase } from '../lib/supabase';

const SUPABASE_URL = 'https://vtmaffcyvhnnmfibfswm.supabase.co';

/**
 * Generates an optimized image URL for profile cards, avatars, and gallery previews.
 * Uses Supabase Storage image transformation when applicable or appends optimization params.
 */
export function getOptimizedImageUrl(
  path?: string | null,
  width = 400,
  quality = 80
): string {
  if (!path) return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

  // Handle base64 image strings and blob URLs directly without Supabase endpoint prefix
  if (path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }

  // If using external URL (e.g. Unsplash, Cloudinary, HTTPS)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    if (path.includes('images.unsplash.com')) {
      const url = new URL(path);
      url.searchParams.set('w', width.toString());
      url.searchParams.set('q', quality.toString());
      url.searchParams.set('auto', 'format');
      return url.toString();
    }
    return path;
  }

  // If relative path from Supabase storage media bucket
  const cleanPath = path.replace(/^\/+/, '');
  return `${SUPABASE_URL}/storage/v1/render/image/public/media/${cleanPath}?width=${width}&quality=${quality}&format=webp`;
}

/**
 * Upload helper with cache control header for high CDN hit rates (1 year caching)
 */
export async function uploadMediaWithCDNCache(
  bucket: string,
  filePath: string,
  file: File | Blob
) {
  return await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600000', // 1 year CDN cache
      upsert: true,
    });
}
