import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// CORS Headers to allow direct client queries if needed
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization, Content-Type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  try {
    const payload = await req.json()
    // The payload comes from the storage.objects INSERT trigger
    const record = payload.record
    
    if (!record || !record.name) {
      throw new Error("Invalid payload: Missing record name in storage object event.")
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ""
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ""

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.")
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Detect bucket name (either lounge-shorts or videos)
    const bucketId = record.bucket_id || 'lounge-shorts'
    const fileName = record.name

    console.log(`Processing video watermark for: bucket='${bucketId}', file='${fileName}'`)

    // 1. Download the raw video from the bucket
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucketId)
      .download(fileName)

    if (downloadError) {
      throw new Error(`Failed to download original video: ${downloadError.message}`)
    }

    // Since we are running in Deno on Supabase Edge, we can process the video.
    // If you have a binary of ffmpeg available in your edge environment, you can run it.
    // Let's check if the video is already watermarked to avoid an infinite recursion trigger!
    if (fileName.includes('-watermarked')) {
      return new Response(JSON.stringify({ success: true, message: "Skipping already watermarked file" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Write input video file to temporary server memory
    const tempInputPath = `/tmp/input_${fileName.replace(/\//g, '_')}`
    const tempOutputPath = `/tmp/output_${fileName.replace(/\//g, '_')}`
    
    await Deno.writeFile(tempInputPath, new Uint8Array(await fileData.arrayBuffer()))

    // Fetch dynamic creator username to burn in the watermark
    let username = "VIP"
    if (fileName.includes('/')) {
      try {
        const userId = fileName.split('/')[0]
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', userId)
          .single()
        if (profileData && profileData.username) {
          username = profileData.username
        }
      } catch (err) {
        console.warn("Failed to lookup creator username, defaulting to 'VIP':", err)
      }
    }

    // 2. Process with ffmpeg
    // NOTE: In the Supabase Custom Docker or VPS environments, ffmpeg is installed natively.
    // In standard Supabase Hosted Edge Functions, you can invoke a subprocess of pre-installed ffmpeg,
    // or use a WebAssembly (WASM) build of FFmpeg, or call an external encoding api.
    // Here is the production-ready shell execution block:
    try {
      let vfArgs: string[] = []
      let logoExists = false

      // Check if the logo asset 'image_5.png' exists in the function directory to use the advanced filter complex
      try {
        const stat = await Deno.stat("./image_5.png").catch(() => null)
        if (stat && stat.isFile) {
          logoExists = true
        }
      } catch (_) {}

      let mapArgs: string[] = []

      if (logoExists) {
        // Advanced: Scale the brand logo image to a height of 24 pixels (keeping aspect ratio)
        // and overlay it with 85% opacity, then write the @username with 65% opacity & black outline
        // We also force standard 30fps conversion using fps=30 before overlaying to prevent variable frame rate lag
        const filterComplex = `[0:v]fps=30[clean_v]; [1:v]scale=-1:24,format=rgba,colorchannelmixer=aa=0.85[scaled_logo]; [clean_v][scaled_logo]overlay=20:20[overlay_v]; [overlay_v]drawtext=text='@${username}':x=20:y=54:fontsize=15:fontcolor=white@0.65:bordercolor=black@0.8:borderw=1.5[w_logo]`
        vfArgs = [
          "-r", "30", // force input to be read at 30fps
          "-i", tempInputPath,
          "-i", "./image_5.png",
          "-filter_complex", filterComplex,
        ]
        mapArgs = [
          "-map", "[w_logo]",
          "-map", "0:a?"
        ]
      } else {
        // Elegant Fallback: Beautiful text-based bouncing watermark with uniform 65% transparency and outline
        // Also force standard 30fps conversion
        const vfString = `fps=30,drawtext=text='🔥 LUSTY GLOBAL VIP':x='if(lt(t,4), 20, w-tw-20)':y='if(lt(t,4), 20, h-th-42)':fontsize=18:fontcolor=white@0.65:bordercolor=black@0.8:borderw=1.5,drawtext=text='@${username}':x='if(lt(t,4), 43, w-tw-20)':y='if(lt(t,4), 42, h-th-20)':fontsize=15:fontcolor=white@0.65:bordercolor=black@0.8:borderw=1.5`
        vfArgs = [
          "-r", "30", // force input to be read at 30fps
          "-i", tempInputPath,
          "-vf", vfString,
        ]
        mapArgs = [
          "-map", "0:v:0",
          "-map", "0:a?"
        ]
      }

      const command = new Deno.Command("ffmpeg", {
        args: [
          "-y", // overwrite output files
          ...vfArgs,
          ...mapArgs,
          "-c:v", "libx264", // standard video codec for maximum device compatibility
          "-profile:v", "high", // ensure high profile encoding compatibility
          "-level:v", "4.0", // level 4.0 matching modern browser player requirements
          "-pix_fmt", "yuv420p", // standard pixel format for universal device rendering
          "-vsync", "cfr", // force constant frame rate to perfectly align with audio sync
          "-c:a", "aac",     // convert audio to AAC format
          "-b:a", "128k",    // standard 128kbps audio bitrate
          "-ar", "44100",    // force standard 44.1kHz sample rate
          "-ac", "2",        // force stereo audio channel layout
          "-async", "1",     // anchor audio start-time to the first video frame to prevent drifting
          "-movflags", "+faststart", // web-optimize the video file container for rapid playback start
          tempOutputPath
        ],
      })
      
      const { code, stderr } = await command.output()
      
      if (code !== 0) {
        const errorString = new TextDecoder().decode(stderr)
        throw new Error(`FFmpeg error (code ${code}): ${errorString}`)
      }

      // 3. Upload the watermarked video back to the bucket
      const watermarkedFile = await Deno.readFile(tempOutputPath)
      const { error: uploadError } = await supabase.storage
        .from(bucketId)
        .upload(fileName, watermarkedFile, {
          contentType: record.metadata?.mimetype || 'video/mp4',
          upsert: true // Overwrite the original file with the branded version
        })

      if (uploadError) {
        throw new Error(`Failed to upload watermarked video: ${uploadError.message}`)
      }

      console.log(`Successfully burnt in watermark for ${fileName}`)

    } catch (ffmpegError: any) {
      console.warn("FFmpeg environment execution failed, fallback to metadata watermark or external encoder:", ffmpegError.message)
      // If native ffmpeg isn't preloaded in the micro-VM, we log this clearly so the user can provision a standard Deno Docker binary or use WASM
      throw ffmpegError
    } finally {
      // Clean up temporary files from server memory to prevent leaking memory
      try {
        await Deno.remove(tempInputPath)
        await Deno.remove(tempOutputPath)
      } catch (_) {}
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Watermark burnt successfully",
      processedFile: fileName 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("Watermark processing failed:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
