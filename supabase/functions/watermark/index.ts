import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization, Content-Type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: CORS_HEADERS 
    });
  }

  try {
    const { videoUrl, hostName, watermarkUrl } = await req.json();

    if (!videoUrl) {
      return new Response(JSON.stringify({ error: "Missing videoUrl" }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 1. Define paths for processing inside the writable /tmp directory
    const inputPath = `/tmp/input_${Date.now()}.mp4`;
    const logoPath = `/tmp/logo_${Date.now()}.png`;
    const outputPath = `/tmp/output_${Date.now()}.mp4`;

    // 2. Fetch the original video file and write it to the temporary local disk
    const videoResponse = await fetch(videoUrl);
    const videoBytes = new Uint8Array(await videoResponse.arrayBuffer());
    await Deno.writeFile(inputPath, videoBytes);

    // 3. Fetch your golden logo asset (hosted in your Supabase Storage bucket or a custom URL)
    const logoUrlToFetch = watermarkUrl || "https://vtmaffcyvhnnmfibfswm.supabase.co/storage/v1/object/public/assets/logo.png";
    const logoResponse = await fetch(logoUrlToFetch);
    const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
    await Deno.writeFile(logoPath, logoBytes);

    // 4. Run FFmpeg command
    // This command: 
    // - Overlays the logo in the corner
    // - Adds the dynamic text creator handle `@username` below the logo
    // - Ensures H.264 video encoding (perfect for iOS/Android playbacks)
    // - Copies the original audio track directly to preserve perfect sound quality (-c:a copy)
    const creatorHandle = `@${hostName || 'VIP'}`;
    const ffmpegProcess = Deno.run({
      cmd: [
        "ffmpeg",
        "-y", // Overwrite output files without asking
        "-i", inputPath,
        "-i", logoPath,
        "-filter_complex",
        `[1:v]scale=120:-1[logo];[0:v][logo]overlay=W-w-24:H-h-60[bg];[bg]drawtext=text='${creatorHandle}':x=W-w-24:y=H-36:fontcolor=white:fontsize=20:box=1:boxcolor=black@0.4:boxborderw=5`,
        "-c:v", "libx264", // Standard H.264 video codec for flawless mobile decoding
        "-pix_fmt", "yuv420p", // Ensures wide player compatibility
        "-c:a", "copy", // Copy audio stream directly (maintains 100% audio quality)
        outputPath
      ],
      stdout: "piped",
      stderr: "piped",
    });

    const status = await ffmpegProcess.status();
    
    if (!status.success) {
      const errorString = new TextDecoder().decode(await ffmpegProcess.stderrOutput());
      console.error("FFmpeg Error details:", errorString);
      throw new Error("FFmpeg execution failed");
    }

    // 5. Read the finalized, beautifully watermarked MP4 file
    const outputBytes = await Deno.readFile(outputPath);

    // Clean up temporary files from Deno local disk memory
    await Deno.remove(inputPath);
    await Deno.remove(logoPath);
    await Deno.remove(outputPath);

    // 6. Send the high-quality MP4 file back to the browser
    return new Response(outputBytes, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="VIP-Short-${Date.now()}.mp4"`,
      },
    });

  } catch (error: any) {
    console.error("Watermark generation failed:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
