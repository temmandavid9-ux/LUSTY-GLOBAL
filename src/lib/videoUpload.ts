import { supabase } from './supabase';

/**
 * Uploads a short video to the Supabase 'videos' or 'lounge-shorts' bucket.
 * Matches the required premium branding and folder layout rules of LUSTY GLOBAL VIP.
 */
export async function uploadShortVideo(currentUserId: string, file: File) {
  try {
    if (!currentUserId) throw new Error("User must be logged in to upload content.");

    // Unique filename to prevent overwriting assets
    const fileExt = file.name.split('.').pop() || 'mp4';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    
    // Path format: currentUserId/fileName.mp4 under 'lounge-shorts' bucket
    const filePath = `${currentUserId}/${fileName}`;

    // Determine correct mime type so the browser streams instead of downloads
    const isWebm = fileExt.toLowerCase() === 'webm';
    const contentType = isWebm ? 'video/webm' : 'video/mp4';

    // 🚀 Upload binary file payload to Supabase Storage ('videos' as primary, fallback to 'lounge-shorts')
    const bucketName = 'lounge-shorts';
    
    // Try uploading to 'lounge-shorts' bucket first
    let { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: contentType
      });

    // If 'lounge-shorts' fails (e.g. if the bucket isn't provisioned yet), try fallback to 'videos' bucket
    if (uploadError) {
      console.warn(`Upload to '${bucketName}' failed, trying fallback 'videos' bucket...`, uploadError.message);
      const fallbackResult = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: contentType
        });
      
      if (fallbackResult.error) {
        throw new Error(`Storage upload error: ${fallbackResult.error.message || uploadError.message}`);
      }
      
      // Generate the public URL from 'videos'
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      return publicUrl;
    }

    // 🔗 Generate the permanent public CDN URL for playback
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error: any) {
    console.error("Storage upload crash:", error.message);
    throw error;
  }
}
