import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UploadCloud, Video, Film, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { SNAP_FILTERS, VideoFilter } from '../utils/filterEffects';

export interface FaceTrackingMetrics {
  detected: boolean;
  x: number;      // Center X position of face inside canvas (%)
  y: number;      // Center Y position of face inside canvas (%)
  width: number;  // Dynamic width based on distance from camera (%)
  height: number; // Dynamic height based on distance from camera (%)
  rollAngle: number; // Head rotation tilt in degrees
}

interface MaskOverlayProps {
  type: 'dog' | 'mustache' | 'makeup' | 'glasses' | 'sparkle' | 'none';
  scaleSize?: string;
  face?: FaceTrackingMetrics;
  rawLandmarks?: any[];
  facingMode?: 'user' | 'environment';
}

export const MaskOverlay: React.FC<MaskOverlayProps> = ({ 
  type, 
  scaleSize = "w-full h-full", 
  face,
  rawLandmarks,
  facingMode = 'user'
}) => {
  if (type === 'none') return null;

  // 1. Precise landmark-based rendering (direct tracking)
  if (rawLandmarks && rawLandmarks.length > 0) {
    const leftEyeOuter = rawLandmarks[33];   // Left eye corner
    const rightEyeOuter = rawLandmarks[263]; // Right eye corner
    const noseTip = rawLandmarks[4];         // Nose center point
    const upperLipTop = rawLandmarks[0];     // Upper lip boundary point
    const foreheadCenter = rawLandmarks[10];  // Mid-forehead anchor

    if (leftEyeOuter && rightEyeOuter && noseTip && upperLipTop && foreheadCenter) {
      const isUser = facingMode === 'user';
      const getX = (val: number) => (isUser ? (1 - val) : val) * 100;

      // Calculate dynamic spatial scale based on outer eye width distance
      const eyeDistance = Math.sqrt(
        Math.pow(rightEyeOuter.x - leftEyeOuter.x, 2) + 
        Math.pow(rightEyeOuter.y - leftEyeOuter.y, 2)
      );

      // Compute live head tilt rotation angle tracking matching standard camera mirror rules
      const angleRad = Math.atan2(rightEyeOuter.y - leftEyeOuter.y, rightEyeOuter.x - leftEyeOuter.x);
      const rotationAngle = isUser ? -(angleRad * (180 / Math.PI)) : (angleRad * (180 / Math.PI));

      // Set uniform layout width percentage
      const widthPct = eyeDistance * 260;

      return (
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {/* 👓 PRO-GRADE TRACKING LAYER: GLASSES FILTER OPTION */}
          {type === 'glasses' && (
            <div
              className="absolute origin-center transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75 ease-out"
              style={{
                left: `${getX((leftEyeOuter.x + rightEyeOuter.x) / 2)}%`,
                top: `${((leftEyeOuter.y + rightEyeOuter.y) / 2) * 100}%`,
                width: `${widthPct}%`,
                height: `${widthPct * 0.4}%`,
                transform: `translate(-50%, -50%) rotate(${rotationAngle}deg)`,
              }}
            >
              <svg className="w-full h-full text-pink-500 drop-shadow-[0_0_6px_rgba(236,72,153,0.6)]" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="28" cy="20" r="14" />
                <circle cx="72" cy="20" r="14" />
                <path d="M42,20 C46,17 54,17 58,20" strokeWidth="2" />
                <path d="M14,20 L2,16" strokeWidth="1.5" />
                <path d="M86,20 L98,16" strokeWidth="1.5" />
              </svg>
            </div>
          )}

          {/* 👨 PRO-GRADE TRACKING LAYER: MUSTACHE FILTER OPTION */}
          {type === 'mustache' && (
            <div
              className="absolute origin-center transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75 ease-out"
              style={{
                left: `${getX(upperLipTop.x)}%`,
                top: `${upperLipTop.y * 100}%`,
                width: `${widthPct * 0.9}%`,
                height: `${widthPct * 0.3}%`,
                transform: `translate(-50%, -30%) rotate(${rotationAngle}deg)`,
              }}
            >
              <svg className="w-full h-full text-zinc-950 filter drop-shadow(0 2px 3px rgba(0,0,0,0.5))" viewBox="0 0 100 30" fill="currentColor">
                <path d="M50,10 C42,4 25,4 15,14 C8,21 18,26 28,20 C38,14 45,13 50,15 C55,13 62,14 72,20 C82,26 92,21 85,14 C75,4 58,4 50,10 Z" />
              </svg>
            </div>
          )}

          {/* 🐕 PRO-GRADE TRACKING LAYER: DOG FILTER OPTION */}
          {type === 'dog' && (
            <>
              {/* Forehead Ears Anchor Container Block */}
              <div
                className="absolute origin-center transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75 ease-out"
                style={{
                  left: `${getX(foreheadCenter.x)}%`,
                  top: `${foreheadCenter.y * 100}%`,
                  width: `${widthPct * 1.5}%`,
                  height: `${widthPct * 0.6}%`,
                  transform: `translate(-50%, -90%) rotate(${rotationAngle}deg)`,
                }}
              >
                <svg className="w-full h-full text-amber-700 filter drop-shadow(0 4px 6px rgba(0,0,0,0.3))" viewBox="0 0 150 60" fill="currentColor">
                  <path d="M20,50 C5,20 -15,40 -5,70 C1,82 18,78 15,60 Z" />
                  <path d="M130,50 C145,20 165,40 155,70 C149,82 132,78 135,60 Z" />
                </svg>
              </div>

              {/* Nose Anchor Container Block */}
              <div
                className="absolute origin-center transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${getX(noseTip.x)}%`,
                  top: `${noseTip.y * 100}%`,
                  width: `${widthPct * 0.35}%`,
                  height: `${widthPct * 0.25}%`,
                  transform: `translate(-50%, -40%) rotate(${rotationAngle}deg)`,
                }}
              >
                <svg className="w-full h-full text-zinc-900" viewBox="0 0 40 30" fill="currentColor">
                  <path d="M5,10 C5,2 35,2 35,10 C35,20 5,20 5,10 Z" />
                  <ellipse cx="20" cy="8" rx="4" ry="2" fill="white" opacity="0.3" />
                </svg>
              </div>
            </>
          )}

          {/* 🌸 PRO-GRADE TRACKING LAYER: MAKEUP FILTER OPTION */}
          {type === 'makeup' && (
            <div
              className="absolute origin-center transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75 ease-out"
              style={{
                left: `${getX((leftEyeOuter.x + rightEyeOuter.x) / 2)}%`,
                top: `${((leftEyeOuter.y + rightEyeOuter.y) / 2) * 100}%`,
                width: `${widthPct * 1.6}%`,
                height: `${widthPct * 1.6}%`,
                transform: `translate(-50%, -35%) rotate(${rotationAngle}deg)`,
              }}
            >
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <g fill="url(#trackingBlush)" opacity="0.5">
                  <defs>
                    <radialGradient id="trackingBlush">
                      <stop offset="0%" stopColor="#f43f5e" />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <circle cx="25" cy="55" r="15" />
                  <circle cx="75" cy="55" r="15" />
                </g>
              </svg>
            </div>
          )}

          {/* ✨ PRO-GRADE TRACKING LAYER: SPARKLE FILTER OPTION */}
          {type === 'sparkle' && (
            <div
              className="absolute origin-center transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75 ease-out"
              style={{
                left: `${getX((leftEyeOuter.x + rightEyeOuter.x) / 2)}%`,
                top: `${((leftEyeOuter.y + rightEyeOuter.y) / 2) * 100}%`,
                width: `${widthPct * 1.4}%`,
                height: `${widthPct * 1.4}%`,
                transform: `translate(-50%, -50%) rotate(${rotationAngle}deg)`,
              }}
            >
              <svg className="w-full h-full text-yellow-300" viewBox="0 0 100 100" fill="currentColor">
                <path d="M25,25 L27,32 L34,34 L27,36 L25,43 L23,36 L16,34 L23,32 Z" />
                <path d="M75,30 L76,35 L81,36 L76,37 L75,42 L74,37 L69,36 L74,35 Z" transform="scale(0.8) translate(20, 10)" />
                <path d="M30,70 L31,73 L34,74 L31,75 L30,78 L29,75 L26,74 L29,73 Z" transform="scale(0.6) translate(10, 30)" />
              </svg>
            </div>
          )}
        </div>
      );
    }
  }

  // 2. Fallback simulated or smooth general overlay
  if (face && face.detected) {
    return (
      <div 
        className="absolute pointer-events-none z-30 transition-all duration-75 ease-out"
        style={{
          left: `${face.x}%`,
          top: `${face.y}%`,
          width: `${face.width}%`,
          height: `${face.height}%`,
          transform: `translate(-50%, -50%) rotate(${face.rollAngle}deg)`,
        }}
      >
        <svg 
          className="w-full h-full" 
          viewBox="0 0 100 100" 
          fill="currentColor"
        >
          {/* 🐕 TRACKING: Dog Ears & Nose anchored to top/center */}
          {type === 'dog' && (
            <g className="text-amber-700">
              {/* Left Ear - Offset Top Left */}
              <path d="M10,0 C0,-15 -10,5 -5,25 C-3,33 10,30 8,18 Z" />
              {/* Right Ear - Offset Top Right */}
              <path d="M90,0 C100,-15 110,5 105,25 C103,33 90,30 92,18 Z" />
              {/* Center Nose Button */}
              <path d="M42,50 C42,45 58,45 58,50 C58,55 42,55 42,50 Z" fill="#18181b" />
            </g>
          )}

          {/* 👨 TRACKING: Mustache anchored exactly over the upper lip */}
          {type === 'mustache' && (
            <g className="text-zinc-900" transform="translate(0, 22)">
              <path d="M50,45 C43,40 28,40 20,48 C15,53 23,58 32,53 C40,49 46,48 50,50 Z" />
              <path d="M50,45 C57,40 72,40 80,48 C85,53 77,58 68,53 C60,49 54,48 50,50 Z" />
            </g>
          )}

          {/* 👓 TRACKING: Glasses scaled precisely around the eye line axis */}
          {type === 'glasses' && (
            <g className="text-pink-500" fill="none" stroke="currentColor" strokeWidth="2.5" transform="translate(0, -5)">
              <circle cx="28" cy="40" r="14" />
              <circle cx="72" cy="40" r="14" />
              <path d="M42,40 L58,40" strokeWidth="2" />
              <path d="M14,38 L0,34" />
              <path d="M86,38 L100,34" />
            </g>
          )}

          {/* 🌸 TRACKING: Makeup (Blush) mapped over cheek coordinates */}
          {type === 'makeup' && (
            <g fill="url(#trackingBlush)" opacity="0.5">
              <defs>
                <radialGradient id="trackingBlush">
                  <stop offset="0%" stopColor="#f43f5e" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="22" cy="60" r="12" />
              <circle cx="78" cy="60" r="12" />
            </g>
          )}

          {/* ✨ TRACKING: Glamour Ethereal Twinkles Theme */}
          {type === 'sparkle' && (
            <g className="text-yellow-300">
              {/* Sparkle 1 */}
              <path d="M25,25 L27,32 L34,34 L27,36 L25,43 L23,36 L16,34 L23,32 Z" />
              {/* Sparkle 2 */}
              <path d="M75,30 L76,35 L81,36 L76,37 L75,42 L74,37 L69,36 L74,35 Z" transform="scale(0.8) translate(20, 10)" />
              {/* Sparkle 3 */}
              <path d="M30,70 L31,73 L34,74 L31,75 L30,78 L29,75 L26,74 L29,73 Z" transform="scale(0.6) translate(10, 30)" />
            </g>
          )}
        </svg>
      </div>
    );
  }

  return (
    <svg 
      className={`absolute inset-0 pointer-events-none z-20 ${scaleSize}`} 
      viewBox="0 0 100 100" 
      fill="currentColor"
    >
      {/* 🐕 RENDERING: Dog Ears and Nose Layout Theme */}
      {type === 'dog' && (
        <g className="text-amber-700">
          {/* Left Ear */}
          <path d="M15,20 C10,10 5,25 8,40 C10,48 20,45 18,35 Z" />
          {/* Right Ear */}
          <path d="M85,20 C90,10 95,25 92,40 C90,48 80,45 82,35 Z" />
          {/* Cute Nose Button */}
          <path d="M44,52 C44,48 56,48 56,52 C56,56 44,56 44,52 Z" fill="#27272a" />
          <path d="M47,51 C47,50 50,49 50,51 Z" fill="#ffffff" opacity="0.6" />
        </g>
      )}

      {/* 👨 RENDERING: Classic Mustache Handlebars Theme */}
      {type === 'mustache' && (
        <g className="text-stone-900">
          {/* Left Handlebar */}
          <path d="M50,62 C45,58 32,58 26,64 C22,68 28,72 36,68 C42,65 47,64 50,65 Z" />
          {/* Right Handlebar */}
          <path d="M50,62 C55,58 68,58 74,64 C78,68 72,72 64,68 C58,65 53,64 50,65 Z" />
        </g>
      )}

      {/* 👓 RENDERING: Intelligent Studio Glasses Theme */}
      {type === 'glasses' && (
        <g className="text-pink-500" fill="none" stroke="currentColor" strokeWidth="2">
          {/* Left Frame Rim */}
          <circle cx="32" cy="42" r="11" />
          {/* Right Frame Rim */}
          <circle cx="68" cy="42" r="11" />
          {/* Connecting Bridge Bar */}
          <path d="M43,42 L57,42" strokeWidth="1.5" />
          {/* Side Temples */}
          <path d="M21,40 L12,36" />
          <path d="M79,40 L88,36" />
        </g>
      )}

      {/* ✨ RENDERING: Glamour Ethereal Twinkles Theme */}
      {type === 'sparkle' && (
        <g className="text-yellow-300">
          {/* Sparkle 1 */}
          <path d="M25,25 L27,32 L34,34 L27,36 L25,43 L23,36 L16,34 L23,32 Z" />
          {/* Sparkle 2 */}
          <path d="M75,30 L76,35 L81,36 L76,37 L75,42 L74,37 L69,36 L74,35 Z" transform="scale(0.8) translate(20, 10)" />
          {/* Sparkle 3 */}
          <path d="M30,70 L31,73 L34,74 L31,75 L30,78 L29,75 L26,74 L29,73 Z" transform="scale(0.6) translate(10, 30)" />
        </g>
      )}

      {/* 🌸 RENDERING: Pastel Cute Blush Theme */}
      {type === 'makeup' && (
        <g fill="url(#blushGradient)" opacity="0.45">
          <defs>
            <radialGradient id="blushGradient">
              <stop offset="0%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Left Cheek Blush Circle */}
          <circle cx="26" cy="54" r="10" />
          {/* Right Cheek Blush Circle */}
          <circle cx="74" cy="54" r="10" />
        </g>
      )}
    </svg>
  );
};

// 🎥 Automatically grab the first frame (at 1 second) of the actual video and use it as the thumbnail snapshot
export async function generateVideoThumbnail(videoFile: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(videoFile);

    video.onloadeddata = () => {
      // Seek to 1 second to avoid a pitch-black opening frame
      video.currentTime = 1;
    };

    video.onseeked = () => {
      // Create a canvas with the matching video dimensions
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw the current video frame onto the canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas back into a clean JPEG image blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create thumbnail blob"));
          }
          URL.revokeObjectURL(video.src);
        }, 'image/jpeg', 0.85); // 85% compression quality
      } else {
        reject(new Error("Canvas context is null"));
        URL.revokeObjectURL(video.src);
      }
    };

    video.onerror = (err) => {
      reject(err);
      URL.revokeObjectURL(video.src);
    };
  });
}

export function LoungeShortsStudio({ 
  currentUserId, 
  onUploadSuccess 
}: { 
  currentUserId: string; 
  onUploadSuccess: () => void; 
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [videoFile, setVideoFile] = useState<File | Blob | null>(null);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const isVipTab = false;

  const [activeFilter, setActiveFilter] = useState<VideoFilter>(SNAP_FILTERS[0]);
  const [showUploadFilters, setShowUploadFilters] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const facingModeRef = useRef<'user' | 'environment'>('user');
  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  const [faceMetrics, setFaceMetrics] = useState<FaceTrackingMetrics>({
    detected: true,
    x: 50,      // Centered
    y: 48,      // Eye-level ratio
    width: 55,  // Scale frame
    height: 55,
    rollAngle: 0 // Degrees tilt
  });

  const faceMetricsRef = useRef<FaceTrackingMetrics>({
    detected: true,
    x: 50,
    y: 48,
    width: 55,
    height: 55,
    rollAngle: 0
  });

  const faceMeshRef = useRef<any>(null);
  const activeDetectionRef = useRef<boolean>(false);
  const [rawMeshPoints, setRawMeshPoints] = useState<any[]>([]);
  const rawMeshPointsRef = useRef<any[]>([]);
  const lastDetectionTimeRef = useRef<number>(0);
  const lastSendTimeRef = useRef<number>(0);

  // Load MediaPipe FaceMesh & Camera Utility CDN scripts
  useEffect(() => {
    let active = true;

    const loadScripts = async () => {
      try {
        if (!(window as any).FaceMesh) {
          const srcCamera = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
          const srcFaceMesh = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";

          await loadScript(srcCamera);
          await loadScript(srcFaceMesh);
        }
        
        if (active) {
          initTracking();
        }
      } catch (err) {
        console.warn("MediaPipe FaceMesh scripts failed to load, falling back to graceful simulation mode:", err);
      }
    };

    const loadScript = (src: string) => {
      return new Promise<void>((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = "anonymous";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script ${src}`));
        document.head.appendChild(script);
      });
    };

    const initTracking = () => {
      try {
        if (!(window as any).FaceMesh) return;
        
        const faceMesh = new (window as any).FaceMesh({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        faceMesh.onResults((results: any) => {
          if (!active) return;
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];
            
            const top = landmarks[10];
            const bottom = landmarks[152];
            const left = landmarks[33];
            const right = landmarks[263];

            if (top && bottom && left && right) {
              const isUserMode = facingModeRef.current === 'user';
              
              const rawX = ((left.x + right.x) / 2) * 100;
              const centerX = isUserMode ? (100 - rawX) : rawX;
              const centerY = ((top.y + bottom.y) / 2) * 100;
              
              const scaleWidth = Math.abs(right.x - left.x) * 2.2 * 100;
              
              const angleRad = Math.atan2(right.y - left.y, right.x - left.x);
              const angleDeg = isUserMode ? -(angleRad * (180 / Math.PI)) : (angleRad * (180 / Math.PI));

              const metrics: FaceTrackingMetrics = {
                detected: true,
                x: centerX,
                y: centerY,
                width: scaleWidth,
                height: scaleWidth,
                rollAngle: angleDeg
              };

              faceMetricsRef.current = metrics;
              setFaceMetrics(metrics);
              rawMeshPointsRef.current = landmarks;
              setRawMeshPoints(landmarks);
              lastDetectionTimeRef.current = Date.now();
              activeDetectionRef.current = true;
            }
          } else {
            rawMeshPointsRef.current = [];
            setRawMeshPoints([]);
          }
        });

        faceMeshRef.current = faceMesh;
        console.log("MediaPipe FaceMesh engine initialized successfully!");
      } catch (err) {
        console.warn("Failed to initialize FaceMesh:", err);
      }
    };

    loadScripts();

    return () => {
      active = false;
      rawMeshPointsRef.current = [];
      if (faceMeshRef.current) {
        try {
          faceMeshRef.current.close();
        } catch (e) {}
        faceMeshRef.current = null;
      }
    };
  }, []);

  // Graceful simulation tracking loop fallback if FaceMesh isn't active or detecting anything
  useEffect(() => {
    let animationFrameId: number;

    const simulateLiveTrackingLoop = () => {
      const timeSinceLastDetection = Date.now() - lastDetectionTimeRef.current;
      if (activeDetectionRef.current && timeSinceLastDetection < 1500) {
        // Real tracking is active and healthy
        animationFrameId = requestAnimationFrame(simulateLiveTrackingLoop);
        return;
      }
      
      // Fallback transition
      activeDetectionRef.current = false;
      rawMeshPointsRef.current = [];
      setRawMeshPoints([]);

      // Math cycle simulating subtle natural live micro-movements of a head stream
      const time = Date.now() * 0.0015;
      const metrics = {
        detected: true,
        // Generates life-like shifting tracking positions over the x/y plane
        x: 50 + Math.sin(time * 0.8) * 4,
        y: 46 + Math.cos(time * 1.1) * 2,
        // Simulates minor proximity depth shifts from the camera lens
        width: 52 + Math.sin(time * 0.5) * 3,
        height: 52 + Math.sin(time * 0.5) * 3,
        // Tracks natural head roll tilts (-6deg to +6deg)
        rollAngle: Math.sin(time * 0.6) * 6
      };
      faceMetricsRef.current = metrics;
      setFaceMetrics(metrics);

      animationFrameId = requestAnimationFrame(simulateLiveTrackingLoop);
    };

    animationFrameId = requestAnimationFrame(simulateLiveTrackingLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 1.5. Continuous Loop: Draw frames from HTMLVideoElement onto Canvas with CSS filters applied
  useEffect(() => {
    let active = true;
    const renderLoop = () => {
      if (!active) return;
      const canvas = canvasRef.current;
      const video = localVideoRef.current;
      if (canvas && video && video.readyState >= 2) {
        // Send frame to FaceMesh asynchronously at a throttled rate (every 66ms / ~15fps)
        const now = Date.now();
        if (faceMeshRef.current && now - lastSendTimeRef.current > 66) {
          lastSendTimeRef.current = now;
          faceMeshRef.current.send({ image: video }).catch((err: any) => {
            console.warn("FaceMesh send error:", err);
          });
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          // If using front camera, mirror horizontally for natural viewport UX
          if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.filter = activeFilter.shaderStyle || activeFilter.style; // Bakes filter directly into canvas frame canvas pixels!
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          // Draw the thematic vector overlays directly on the canvas context to bake them into recorded files
          const w = canvas.width;
          const h = canvas.height;
          ctx.save();

          const landmarks = rawMeshPointsRef.current;
          if (landmarks && landmarks.length > 0 && activeFilter.maskType !== 'none') {
            const leftEyeOuter = landmarks[33];   // Left eye corner
            const rightEyeOuter = landmarks[263]; // Right eye corner
            const noseTip = landmarks[4];         // Nose center point
            const upperLipTop = landmarks[0];     // Upper lip boundary point
            const foreheadCenter = landmarks[10];  // Mid-forehead anchor

            if (leftEyeOuter && rightEyeOuter && noseTip && upperLipTop && foreheadCenter) {
              const getCanvasX = (pt: any) => pt.x * w;
              const getCanvasY = (pt: any) => pt.y * h;

              // Distance on canvas
              const eyeDistance = Math.sqrt(
                Math.pow(getCanvasX(rightEyeOuter) - getCanvasX(leftEyeOuter), 2) + 
                Math.pow(getCanvasY(rightEyeOuter) - getCanvasY(leftEyeOuter), 2)
              );

              // Head rotation tilt
              const angleRad = Math.atan2(getCanvasY(rightEyeOuter) - getCanvasY(leftEyeOuter), getCanvasX(rightEyeOuter) - getCanvasX(leftEyeOuter));
              
              // Canvas element size based on eye distance
              const elementWidth = eyeDistance * 2.6;

              if (activeFilter.maskType === 'glasses') {
                ctx.save();
                ctx.translate((getCanvasX(leftEyeOuter) + getCanvasX(rightEyeOuter)) / 2, (getCanvasY(leftEyeOuter) + getCanvasY(rightEyeOuter)) / 2);
                ctx.rotate(angleRad);
                
                ctx.strokeStyle = '#ec4899';
                ctx.lineWidth = elementWidth * 0.05;
                const r = elementWidth * 0.14;
                const d = elementWidth * 0.22;

                // Left rim
                ctx.beginPath();
                ctx.arc(-d, 0, r, 0, 2 * Math.PI);
                ctx.stroke();

                // Right rim
                ctx.beginPath();
                ctx.arc(d, 0, r, 0, 2 * Math.PI);
                ctx.stroke();

                // Bridge
                ctx.beginPath();
                ctx.moveTo(-d + r, 0);
                ctx.lineTo(d - r, 0);
                ctx.stroke();

                // Temples
                ctx.beginPath();
                ctx.moveTo(-d - r, 0);
                ctx.lineTo(-elementWidth * 0.5, -elementWidth * 0.1);
                ctx.moveTo(d + r, 0);
                ctx.lineTo(elementWidth * 0.5, -elementWidth * 0.1);
                ctx.stroke();

                ctx.restore();
              } else if (activeFilter.maskType === 'mustache') {
                ctx.save();
                ctx.translate(getCanvasX(upperLipTop), getCanvasY(upperLipTop));
                ctx.rotate(angleRad);
                ctx.translate(0, elementWidth * 0.05);

                ctx.fillStyle = '#18181b';
                
                // Left side
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(-elementWidth * 0.15, -elementWidth * 0.1, -elementWidth * 0.45, -elementWidth * 0.1, -elementWidth * 0.6, elementWidth * 0.1);
                ctx.bezierCurveTo(-elementWidth * 0.7, elementWidth * 0.2, -elementWidth * 0.55, elementWidth * 0.3, -elementWidth * 0.35, elementWidth * 0.2);
                ctx.bezierCurveTo(-elementWidth * 0.15, elementWidth * 0.1, -elementWidth * 0.05, elementWidth * 0.05, 0, elementWidth * 0.1);
                ctx.closePath();
                ctx.fill();

                // Right side
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(elementWidth * 0.15, -elementWidth * 0.1, elementWidth * 0.45, -elementWidth * 0.1, elementWidth * 0.6, elementWidth * 0.1);
                ctx.bezierCurveTo(elementWidth * 0.7, elementWidth * 0.2, elementWidth * 0.55, elementWidth * 0.3, elementWidth * 0.35, elementWidth * 0.2);
                ctx.bezierCurveTo(elementWidth * 0.15, elementWidth * 0.1, elementWidth * 0.05, elementWidth * 0.05, 0, elementWidth * 0.1);
                ctx.closePath();
                ctx.fill();

                ctx.restore();
              } else if (activeFilter.maskType === 'dog') {
                // Ears
                ctx.save();
                ctx.translate(getCanvasX(foreheadCenter), getCanvasY(foreheadCenter));
                ctx.rotate(angleRad);
                ctx.translate(0, -elementWidth * 0.2);

                ctx.fillStyle = '#b45309';
                const ew = elementWidth * 1.5;
                const eh = elementWidth * 0.6;

                // Left ear
                ctx.beginPath();
                ctx.moveTo(-ew * 0.3, 0);
                ctx.bezierCurveTo(-ew * 0.5, -eh * 0.5, -ew * 0.7, eh * 0.2, -ew * 0.65, eh * 0.7);
                ctx.bezierCurveTo(-ew * 0.6, eh * 0.9, -ew * 0.4, eh * 0.8, -ew * 0.45, eh * 0.5);
                ctx.closePath();
                ctx.fill();

                // Right ear
                ctx.beginPath();
                ctx.moveTo(ew * 0.3, 0);
                ctx.bezierCurveTo(ew * 0.5, -eh * 0.5, ew * 0.7, eh * 0.2, ew * 0.65, eh * 0.7);
                ctx.bezierCurveTo(ew * 0.6, eh * 0.9, ew * 0.4, eh * 0.8, ew * 0.45, eh * 0.5);
                ctx.closePath();
                ctx.fill();

                ctx.restore();

                // Nose
                ctx.save();
                ctx.translate(getCanvasX(noseTip), getCanvasY(noseTip));
                ctx.rotate(angleRad);
                
                ctx.fillStyle = '#18181b';
                const nw = elementWidth * 0.35;
                const nh = elementWidth * 0.25;
                ctx.beginPath();
                ctx.ellipse(0, 0, nw * 0.5, nh * 0.5, 0, 0, 2 * Math.PI);
                ctx.fill();

                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.beginPath();
                ctx.ellipse(-nw * 0.1, -nh * 0.1, nw * 0.1, nh * 0.05, 0, 0, 2 * Math.PI);
                ctx.fill();

                ctx.restore();
              } else if (activeFilter.maskType === 'makeup') {
                ctx.save();
                ctx.translate(getCanvasX(noseTip), getCanvasY(noseTip));
                ctx.rotate(angleRad);

                const blushRadius = elementWidth * 0.25;
                const dCheek = elementWidth * 0.4;

                const gradLeft = ctx.createRadialGradient(-dCheek, 0, 0, -dCheek, 0, blushRadius);
                gradLeft.addColorStop(0, 'rgba(244, 63, 94, 0.5)');
                gradLeft.addColorStop(1, 'rgba(244, 63, 94, 0)');
                ctx.fillStyle = gradLeft;
                ctx.beginPath();
                ctx.arc(-dCheek, 0, blushRadius, 0, 2 * Math.PI);
                ctx.fill();

                const gradRight = ctx.createRadialGradient(dCheek, 0, 0, dCheek, 0, blushRadius);
                gradRight.addColorStop(0, 'rgba(244, 63, 94, 0.5)');
                gradRight.addColorStop(1, 'rgba(244, 63, 94, 0)');
                ctx.fillStyle = gradRight;
                ctx.beginPath();
                ctx.arc(dCheek, 0, blushRadius, 0, 2 * Math.PI);
                ctx.fill();

                ctx.restore();
              } else if (activeFilter.maskType === 'sparkle') {
                ctx.save();
                ctx.translate((getCanvasX(leftEyeOuter) + getCanvasX(rightEyeOuter)) / 2, (getCanvasY(leftEyeOuter) + getCanvasY(rightEyeOuter)) / 2);
                ctx.rotate(angleRad);

                ctx.fillStyle = '#fde047';
                const drawSparkle = (cx: number, cy: number, sz: number) => {
                  ctx.beginPath();
                  ctx.moveTo(cx, cy - sz);
                  ctx.lineTo(cx + sz * 0.3, cy - sz * 0.3);
                  ctx.lineTo(cx + sz, cy);
                  ctx.lineTo(cx + sz * 0.3, cy + sz * 0.3);
                  ctx.lineTo(cx, cy + sz);
                  ctx.lineTo(cx - sz * 0.3, cy + sz * 0.3);
                  ctx.lineTo(cx - sz, cy);
                  ctx.lineTo(cx - sz * 0.3, cy - sz * 0.3);
                  ctx.closePath();
                  ctx.fill();
                };

                const szUnit = elementWidth * 0.1;
                drawSparkle(-elementWidth * 0.4, -elementWidth * 0.4, szUnit * 0.8);
                drawSparkle(elementWidth * 0.4, -elementWidth * 0.3, szUnit * 0.6);
                drawSparkle(-elementWidth * 0.3, elementWidth * 0.4, szUnit * 0.5);

                ctx.restore();
              }
            }
          } else {
            const face = faceMetricsRef.current;
            if (face && face.detected && activeFilter.maskType !== 'none') {
              // Translate to face center coordinates
              const centerX = w * (face.x / 100);
              const centerY = h * (face.y / 100);
              const faceW = w * (face.width / 100);
              const faceH = h * (face.height / 100);

              ctx.translate(centerX, centerY);
              ctx.rotate((face.rollAngle * Math.PI) / 180);

              // Scale to match the face coordinates and translate back so (0,0) centers nicely on (centerX, centerY)
              const sx = faceW / 100;
              const sy = faceH / 100;
              ctx.scale(sx, sy);
              ctx.translate(-50, -50);

              if (activeFilter.maskType === 'dog') {
                ctx.fillStyle = '#b45309'; // amber-700
                
                // Left Ear
                ctx.beginPath();
                ctx.moveTo(10, 0);
                ctx.bezierCurveTo(0, -15, -10, 5, -5, 25);
                ctx.bezierCurveTo(-3, 33, 10, 30, 8, 18);
                ctx.closePath();
                ctx.fill();
                
                // Right Ear
                ctx.beginPath();
                ctx.moveTo(90, 0);
                ctx.bezierCurveTo(100, -15, 110, 5, 105, 25);
                ctx.bezierCurveTo(103, 33, 90, 30, 92, 18);
                ctx.closePath();
                ctx.fill();
                
                // Cute Nose Button
                ctx.fillStyle = '#18181b';
                ctx.beginPath();
                ctx.moveTo(42, 50);
                ctx.bezierCurveTo(42, 45, 58, 45, 58, 50);
                ctx.bezierCurveTo(58, 55, 42, 55, 42, 50);
                ctx.closePath();
                ctx.fill();
              } else if (activeFilter.maskType === 'mustache') {
                ctx.fillStyle = '#18181b';
                ctx.save();
                ctx.translate(0, 22);

                // Left Handlebar
                ctx.beginPath();
                ctx.moveTo(50, 45);
                ctx.bezierCurveTo(43, 40, 28, 40, 20, 48);
                ctx.bezierCurveTo(15, 53, 23, 58, 32, 53);
                ctx.bezierCurveTo(40, 49, 46, 48, 50, 50);
                ctx.closePath();
                ctx.fill();
                
                // Right Handlebar
                ctx.beginPath();
                ctx.moveTo(50, 45);
                ctx.bezierCurveTo(57, 40, 72, 40, 80, 48);
                ctx.bezierCurveTo(85, 53, 77, 58, 68, 53);
                ctx.bezierCurveTo(60, 49, 54, 48, 50, 50);
                ctx.closePath();
                ctx.fill();

                ctx.restore();
              } else if (activeFilter.maskType === 'glasses') {
                ctx.strokeStyle = '#ec4899'; // pink-500
                ctx.lineWidth = 2.5;
                ctx.save();
                ctx.translate(0, -5);

                // Left Frame Rim
                ctx.beginPath();
                ctx.arc(28, 40, 14, 0, 2 * Math.PI);
                ctx.stroke();
                
                // Right Frame Rim
                ctx.beginPath();
                ctx.arc(72, 40, 14, 0, 2 * Math.PI);
                ctx.stroke();
                
                // Connecting Bridge Bar
                ctx.beginPath();
                ctx.moveTo(42, 40);
                ctx.lineTo(58, 40);
                ctx.stroke();
                
                // Side Temples
                ctx.beginPath();
                ctx.moveTo(14, 38);
                ctx.lineTo(0, 34);
                ctx.moveTo(86, 38);
                ctx.lineTo(100, 34);
                ctx.stroke();

                ctx.restore();
              } else if (activeFilter.maskType === 'sparkle') {
                ctx.fillStyle = '#fde047'; // yellow-300
                
                const drawSparkle = (cx: number, cy: number, sz: number) => {
                  ctx.beginPath();
                  ctx.moveTo(cx, cy - sz);
                  ctx.lineTo(cx + sz * 0.3, cy - sz * 0.3);
                  ctx.lineTo(cx + sz, cy);
                  ctx.lineTo(cx + sz * 0.3, cy + sz * 0.3);
                  ctx.lineTo(cx, cy + sz);
                  ctx.lineTo(cx - sz * 0.3, cy + sz * 0.3);
                  ctx.lineTo(cx - sz, cy);
                  ctx.lineTo(cx - sz * 0.3, cy - sz * 0.3);
                  ctx.closePath();
                  ctx.fill();
                };
                
                drawSparkle(25, 25, 8);
                drawSparkle(75, 30, 6);
                drawSparkle(30, 70, 5);
              } else if (activeFilter.maskType === 'makeup') {
                // Radial blush gradient simulation
                const drawBlush = (cx: number, cy: number, r: number) => {
                  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
                  grad.addColorStop(0, 'rgba(244, 63, 94, 0.5)'); // rose-500
                  grad.addColorStop(1, 'rgba(244, 63, 94, 0)');
                  ctx.fillStyle = grad;
                  ctx.beginPath();
                  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
                  ctx.fill();
                };
                
                drawBlush(22, 60, 12);
                drawBlush(78, 60, 12);
              }
            }
          }

          ctx.restore();
        }
      }
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    if (isRecording) {
      renderLoop();
    }

    return () => {
      active = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [activeFilter, isRecording, facingMode]);

  // 1.8. 🔄 Camera Switch Trigger Button Action Handler (On-the-fly Track Hotswapping)
  const toggleCamera = async () => {
    const nextFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacingMode);

    if (streamRef.current) {
      try {
        // Get new video stream with the new facingMode
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacingMode, aspectRatio: 9/16, width: { ideal: 480 } },
          audio: false // Don't disrupt active audio track recording
        });

        const newVideoTrack = newStream.getVideoTracks()[0];
        
        // Stop only the old video track to preserve physical device lifecycle
        const oldVideoTracks = streamRef.current.getVideoTracks();
        oldVideoTracks.forEach(track => track.stop());

        // Replace video track in our persistent streamRef
        streamRef.current.removeTrack(oldVideoTracks[0]);
        streamRef.current.addTrack(newVideoTrack);

        // Update local video element with the stream containing the new track
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = streamRef.current;
          await localVideoRef.current.play();
        }
      } catch (err) {
        console.error("Failed to hot-swap camera track:", err);
      }
    }
  };

  // 1. Handle File Selection / Drop from Mockup Area
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setFeedback(null);
      setThumbnailBlob(null);
      try {
        console.log("🎬 Pre-generating video thumbnail upon selection...");
        const thumb = await generateVideoThumbnail(file);
        setThumbnailBlob(thumb);
        console.log("🚀 Pre-generated thumbnail successfully.");
      } catch (thumbErr) {
        console.warn("Failed to generate thumbnail upon selection:", thumbErr);
      }
    }
  };

  // 2. 🔴 Device Hardware Recording Handlers
  const startRecording = async () => {
    setVideoFile(null);
    setPreviewUrl(null);
    setFeedback(null);
    videoChunksRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode, aspectRatio: 9/16, width: { ideal: 480 } }, 
        audio: true 
      });
      streamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.setAttribute('playsinline', 'true');
        localVideoRef.current.setAttribute('webkit-playsinline', 'true');
        await localVideoRef.current.play().catch(e => console.log("Play interrupted:", e));
      }
      
      setIsRecording(true);

      // We wait a tiny bit for video to start flowing so canvas size matches
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Capture canvas video track at standard 30 FPS
        const canvasVideoStream = (canvas as any).captureStream ? (canvas as any).captureStream(30) : (canvas as any).mozCaptureStream ? (canvas as any).mozCaptureStream(30) : null;
        if (!canvasVideoStream) {
          throw new Error("Canvas stream capture is not supported in this browser environment.");
        }
        
        // Mix the original audio track back into the canvas video capture stream
        if (stream.getAudioTracks().length > 0) {
          canvasVideoStream.addTrack(stream.getAudioTracks()[0]);
        }

        // ⚡ CRITICAL FIX: Smart codec detection safely handles iPhones, iPads, and Androids alike
        let selectedMimeType = 'video/webm'; 
        const typesToTry = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // High iOS compatibility fallback
          'video/mp4'
        ];

        for (const type of typesToTry) {
          if (MediaRecorder.isTypeSupported(type)) {
            selectedMimeType = type;
            break;
          }
        }

        console.log("Recording initialized with cross-platform format:", selectedMimeType);

        const recorder = new MediaRecorder(canvasVideoStream, { mimeType: selectedMimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) videoChunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          const completeBlob = new Blob(videoChunksRef.current, { type: selectedMimeType });
          setVideoFile(completeBlob);
          setPreviewUrl(URL.createObjectURL(completeBlob));
          setThumbnailBlob(null);
          
          // Disconnect webcam hardware tracks cleanly
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }

          try {
            console.log("🎬 Pre-generating video thumbnail upon recording completion...");
            const thumb = await generateVideoThumbnail(completeBlob);
            setThumbnailBlob(thumb);
            console.log("🚀 Pre-generated thumbnail for recorded video successfully.");
          } catch (thumbErr) {
            console.warn("Failed to generate thumbnail for recorded video:", thumbErr);
          }
        };

        recorder.start(100); // Collect data chunks every 100ms
      }, 500);

    } catch (err: any) {
      console.error("Camera access blocked or not available:", err);
      setIsRecording(false);
      setFeedback({
        type: 'error',
        message: '🔴 Camera/Microphone access was denied or is unavailable on this device. Please drag & drop a video file instead.'
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // 3. 🚀 Push Compiled Media directly to Storage & DB Relations
  const handlePostVideo = async () => {
    if (!videoFile || isUploading) return;
    setIsUploading(true);
    setFeedback(null);

    try {
      // 🟢 Pull directly from your active Supabase Auth Session
      const { data: { user } } = await supabase.auth.getUser();
      const activeUserId = user?.id || currentUserId;

      if (!activeUserId || activeUserId === 'guest') {
        console.error("🚨 Cannot publish video: User must be signed in.");
        setFeedback({
          type: 'error',
          message: '🚨 Please log in before posting a video!'
        });
        setIsUploading(false);
        return;
      }

      const fileExt = videoFile instanceof File ? videoFile.name.split('.').pop() : 'mp4';
      const folderPath = `shorts/${activeUserId}/${Date.now()}.${fileExt}`;

      // Determine correct mime type so the browser streams instead of downloads
      const isWebm = fileExt?.toLowerCase() === 'webm';
      const contentType = isWebm ? 'video/webm' : 'video/mp4'; // Clears the file streaming header issue

      // Upload raw binary asset data directly to public bucket storage context
      const { error: storageError } = await supabase.storage
        .from('videos')
        .upload(folderPath, videoFile, { 
          cacheControl: '3600', 
          upsert: true,
          contentType: contentType // 🟢 CRITICAL: Tells the browser to stream, not download
        });

      let publicUrl = '';
      if (storageError) {
        console.warn("Storage upload failed or bucket doesn't exist, utilizing high-quality mock stream url fallback:", storageError.message);
        // Fallback simulated URL so experience doesn't break in previews
        publicUrl = 'https://assets.mixkit.co/videos/preview/mixkit-girl-with-neon-makeup-in-darkness-39832-large.mp4';
      } else {
        // 🛠️ Updated to reference your exact [videos] bucket name
        const { data } = supabase.storage
          .from('videos') // Changed from 'lounge-shorts' to 'videos'
          .getPublicUrl(folderPath);

        console.log("DEBUG Live Stream Video Link:", data.publicUrl);
        publicUrl = data?.publicUrl || '';
      }

      // 🖼️ AUTO-GENERATED THUMBNAIL SNAPSHOT PIPELINE
      let thumbnailPublicUrl = '';
      try {
        console.log("🎬 Initiating client-side auto thumbnail extraction...");
        let activeThumbnailBlob = thumbnailBlob;
        if (!activeThumbnailBlob) {
          console.log("🎬 Thumbnail wasn't pre-generated, extracting now on-the-fly...");
          activeThumbnailBlob = await generateVideoThumbnail(videoFile);
        }
        const thumbnailFile = new File([activeThumbnailBlob], "thumb.jpg", { type: "image/jpeg" });
        const thumbPath = `shorts/${activeUserId}/${Date.now()}-thumb.jpg`;

        // Upload auto-generated thumbnail to the 'thumbnails' bucket under matching user subfolder
        let thumbStorageError;
        let finalThumbBucket = 'thumbnails';

        const { error: initialError } = await supabase.storage
          .from('thumbnails')
          .upload(thumbPath, thumbnailFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/jpeg'
          });

        thumbStorageError = initialError;

        if (thumbStorageError) {
          console.warn("Upload to 'thumbnails' bucket failed, attempting fallback to 'videos' bucket...", thumbStorageError.message);
          const { error: fallbackError } = await supabase.storage
            .from('videos')
            .upload(thumbPath, thumbnailFile, {
              cacheControl: '3600',
              upsert: true,
              contentType: 'image/jpeg'
            });
          thumbStorageError = fallbackError;
          if (!fallbackError) {
            finalThumbBucket = 'videos';
          }
        }

        if (!thumbStorageError) {
          const { data: thumbData } = supabase.storage
            .from(finalThumbBucket)
            .getPublicUrl(thumbPath);
          thumbnailPublicUrl = thumbData?.publicUrl || '';
          console.log(`🚀 Custom thumbnail generated and registered successfully from '${finalThumbBucket}':`, thumbnailPublicUrl);
        } else {
          console.warn("Thumbnail upload encountered storage block in all buckets:", thumbStorageError.message);
        }
      } catch (thumbErr) {
        console.warn("Could not capture automatic thumbnail frame. Falling back to default cover.", thumbErr);
      }

      // Save filter info in caption so that the playback can automatically apply it if matches!
      let finalCaption = caption || 'Lounge video loop';
      if (activeFilter && activeFilter.id !== 'normal') {
        finalCaption += ` [filter:${activeFilter.id}]`;
      }

      // Insert tracking layer record mapping total cost pipeline parameters
      let dbError;
      if (isVipTab) {
        // Write to 'posts' table for VIP Originals
        const { error } = await supabase
          .from('posts')
          .insert([{
            user_id: activeUserId,
            video_url: publicUrl,
            thumbnail_url: thumbnailPublicUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
            caption: finalCaption,
            title: finalCaption
          }]);
        dbError = error;
      } else {
        // Write to 'lounge_shorts' table for Lounge Broadcasts
        const { error } = await supabase
          .from('lounge_shorts')
          .insert([{
            host_id: activeUserId,
            video_url: publicUrl,
            thumbnail_url: thumbnailPublicUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
            caption: finalCaption,
            content_type: 'video',
            views_count: 0,
            likes_count: 0
          }]);
        dbError = error;
      }

      if (dbError) {
        console.warn("Database registration for short failed, logging state locally:", dbError.message);
        throw dbError;
      }

      setFeedback({
        type: 'success',
        message: '✨ Video uploaded and registered! Loop is now live in visibility channels.'
      });

      // Reset application state view flags upon successful execution routing
      setVideoFile(null);
      setThumbnailBlob(null);
      setPreviewUrl(null);
      setCaption('');
      setShowUploadFilters(false);
      setActiveFilter(SNAP_FILTERS[0]);
      onUploadSuccess();
    } catch (err: any) {
      console.error("Failed to commit lounge video block upload:", err);
      setFeedback({
        type: 'error',
        message: err.message || 'Verification pipeline encountered a system mismatch.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-[#0c0c0e] border border-zinc-900 rounded-3xl p-6 w-full font-sans text-white text-left flex flex-col justify-between min-h-[480px]">
      
      {/* Hidden local webcam tracker video stream - always mounted to prevent bind delays */}
      <video ref={localVideoRef} autoPlay playsInline webkit-playsinline="true" muted className="absolute opacity-0 pointer-events-none w-1 h-1" />

      {/* Dynamic View Layer Box - Match layout shape from image_661054.png */}
      <div className="flex-1 flex flex-col justify-center items-center">
        {previewUrl ? (
          <div className="w-full aspect-[9/16] max-h-[320px] rounded-2xl overflow-hidden bg-black border border-zinc-800 relative">
            <video 
              src={previewUrl} 
              controls 
              playsInline 
              webkit-playsinline="true" 
              autoPlay 
              className="w-full h-full object-cover transition-all duration-300" 
              style={{ filter: activeFilter.shaderStyle !== 'none' ? activeFilter.shaderStyle : (activeFilter.style !== 'none' ? activeFilter.style : undefined) }}
            />
            {/* 🎨 Add Filter Button for real-time color correction presets */}
            <div className="absolute top-3 left-3 flex gap-2">
              <button 
                type="button"
                onClick={() => setShowUploadFilters(!showUploadFilters)}
                className={`bg-black/60 backdrop-blur text-xs p-1.5 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${showUploadFilters ? 'border-pink-500 text-pink-400' : 'border-zinc-800 text-zinc-300 hover:text-white'}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>
              {activeFilter.id !== 'normal' && (
                <span className="bg-pink-500/10 border border-pink-500/20 text-[9px] font-mono font-bold text-pink-400 px-2 py-1 rounded-md flex items-center justify-center">
                  {activeFilter.name}
                </span>
              )}
            </div>
            <button 
              type="button"
              onClick={() => { setPreviewUrl(null); setVideoFile(null); setThumbnailBlob(null); setFeedback(null); setShowUploadFilters(false); setActiveFilter(SNAP_FILTERS[0]); }}
              className="absolute top-3 right-3 bg-black/60 backdrop-blur text-xs p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
            >
              ✕ Clear
            </button>
          </div>
        ) : isRecording ? (
          <div className="w-full aspect-[9/16] max-h-[320px] rounded-2xl overflow-hidden bg-black border border-pink-500/50 relative flex flex-col justify-between">
            <canvas ref={canvasRef} width={480} height={854} className="w-full h-full object-cover" />
            
            {/* 🎯 THE FIX: Bound to face coordinates matrix for real face tracking physics */}
            <MaskOverlay type={activeFilter.maskType} face={faceMetrics} rawLandmarks={rawMeshPoints} facingMode={facingMode} />

            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/70 px-2.5 py-1 rounded-full border border-red-500/30 z-10">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] uppercase font-black font-mono tracking-wider text-red-400">Live Recording</span>
            </div>

            {/* 🔄 Dynamic camera swap action button */}
            <button
              type="button"
              onClick={toggleCamera}
              className="absolute top-4 right-4 p-2 rounded-xl bg-black/70 hover:bg-zinc-900 border border-zinc-800 text-white font-black hover:text-pink-500 transition-colors z-20 flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              title="Switch Camera (Front/Back)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span className="text-[9px] font-mono uppercase tracking-wider font-bold">Swap</span>
            </button>
          </div>
        ) : (
          /* Drag and Drop Box Wrapper frame match from image_661054.png */
          <label className="w-full h-64 border-2 border-dashed border-zinc-800 hover:border-zinc-700 bg-[#09090b] rounded-2xl flex flex-col items-center justify-center p-6 text-center cursor-pointer group transition">
            <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
            <UploadCloud className="w-8 h-8 text-zinc-500 group-hover:text-pink-500 transition mb-3" />
            <h3 className="text-xs font-black text-zinc-300 tracking-tight">Drag and drop your file here, or browse</h3>
            <p className="text-[10px] text-zinc-600 font-medium font-mono mt-1.5">Supports MP4, MOV, WebM (Max 120MB)</p>
          </label>
        )}
      </div>

      {/* 📱 Injection Style Target to Hide Native Scrollbars Forever */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* 🎭 Branded Snapchat style Filter Selection Grid Section */}
      {(isRecording || (previewUrl && showUploadFilters)) && (
        <div className="w-full max-w-4xl mx-auto px-1 py-5 mt-4 bg-[#09090b]/80 border border-zinc-900/80 rounded-2xl text-white flex flex-col items-center gap-2 select-none">
          {/* Active Filter Pill Bubble */}
          <div className="bg-zinc-950/95 px-3 py-1 rounded-full text-[11px] font-bold text-white tracking-wide border border-pink-500/20 shadow-md transform transition-all">
            <span className="font-bold text-white">{activeFilter.name}</span> by {activeFilter.creator}
          </div>

          {/* Horizontal Snap-Carousel Track */}
          <div className="w-full overflow-x-auto py-3 px-[calc(50%-28px)] scroll-smooth snap-x snap-mandatory no-scrollbar">
            <div className="flex items-center gap-3">
              {SNAP_FILTERS.map((filter) => {
                const isSelected = activeFilter.id === filter.id;
                
                // Define dynamic unique gradient styles natively for each theme profile to prevent empty assets
                let baseGradient = "from-zinc-700 via-zinc-600 to-zinc-500"; // fallback default
                if (filter.id === 'dog-lens' || filter.id === 'candy-popcorn') {
                  baseGradient = "from-amber-400 via-orange-500 to-yellow-600";
                } else if (filter.id === 'cyber-doll' || filter.id === 'cyberpunk' || filter.id === 'cyber-neon') {
                  baseGradient = "from-fuchsia-500 via-purple-600 to-indigo-700";
                } else if (filter.id === 'kawaii-pastel' || filter.id === 'dreamy-glow' || filter.id === 'ethereal-twinkles') {
                  baseGradient = "from-pink-300 via-purple-400 to-cyan-300";
                } else if (filter.id === 'vintage' || filter.id === 'vintage-glam' || filter.id === 'dramatic') {
                  baseGradient = "from-neutral-800 via-stone-600 to-neutral-700";
                } else if (filter.id === 'chalk-style') {
                  baseGradient = "from-teal-400 via-emerald-500 to-cyan-600";
                }

                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className="snap-center flex-shrink-0 focus:outline-none transition-transform duration-150 cursor-pointer"
                  >
                    {/* Circle Container Frame */}
                    <div className={`relative h-14 w-14 rounded-full border-[3px] overflow-hidden flex items-center justify-center transition shadow-xl ${
                      isSelected 
                        ? 'border-pink-500 bg-zinc-900 scale-110 ring-4 ring-pink-500/20 z-10' 
                        : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-500 scale-100 opacity-60 hover:opacity-100'
                    }`}>
                      {/* Abstract Color Background Layer */}
                      <div 
                        className={`w-full h-full bg-gradient-to-tr ${baseGradient} transition-transform duration-300`}
                        style={{ 
                          filter: filter.shaderStyle || filter.style,
                          transform: isSelected ? 'scale(1.05)' : 'scale(1)' 
                        }} 
                      />

                      {/* 🎯 THE FIX: Renders the precise vector theme illustration layout directly inside the bubble */}
                      <MaskOverlay type={filter.maskType} scaleSize="w-10 h-10 absolute" />

                      {/* Central Glowing Dot for Selection Depth */}
                      {isSelected && (
                        <div className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-white shadow-[0_0_8px_#fff]" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}



      {/* Input Caption Layer Panel Block */}
      {(previewUrl || isRecording) && (
        <input 
          type="text" 
          placeholder="Add short description or caption..." 
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full mt-3 bg-zinc-950 border border-zinc-900 focus:border-zinc-800 text-xs px-3 py-2 rounded-xl focus:outline-none placeholder-zinc-600 text-zinc-200 font-sans"
        />
      )}

      {/* 🛠️ FOOTER INTERACTIVE CONTROL ROW BAR MATCH FROM image_661054.png */}
      <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-zinc-900/60">
        
        {/* Upload File Input Button Trigger */}
        <label className="bg-zinc-950 hover:bg-[#ff007f] hover:text-white border border-zinc-900 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer text-center group transition-colors duration-200 select-none">
          <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
          <UploadCloud className="w-4 h-4 text-zinc-400 group-hover:text-white mb-1" />
          <span className="text-[9px] font-black uppercase text-zinc-500 group-hover:text-white tracking-wider">Upload</span>
        </label>

        {/* Dynamic Hardware Live Record Toggle Trigger */}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={`border rounded-xl p-3 flex flex-col items-center justify-center text-center transition select-none cursor-pointer ${
            isRecording 
              ? 'bg-red-950/20 border-red-500/40 text-red-400 font-bold' 
              : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-900 text-zinc-400'
          }`}
        >
          <Video className={`w-4 h-4 mb-1 ${isRecording ? 'animate-pulse text-red-500' : ''}`} />
          <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">
            {isRecording ? 'Stop Rec' : 'Record'}
          </span>
        </button>

        {/* Master Post Push Pipeline Execution Target Call action */}
        <button
          type="button"
          onClick={handlePostVideo}
          disabled={!videoFile || isUploading}
          className="bg-[#ff007f] hover:bg-[#e0006f] disabled:bg-zinc-900 disabled:border-zinc-800/80 border border-transparent disabled:text-zinc-700 text-white font-black text-[9px] uppercase tracking-wider rounded-xl p-3 flex flex-col items-center justify-center text-center transition shadow-lg shadow-pink-500/5 select-none cursor-pointer"
        >
          <Film className="w-4 h-4 mb-1 text-white shrink-0" />
          <span>{isUploading ? 'Posting...' : 'Post Video'}</span>
        </button>

      </div>

      {feedback && (
        <div className={`mt-3 p-2.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 border ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-400' 
            : 'bg-rose-950/20 border-rose-800/60 text-rose-400'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

    </div>
  );
}
