import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Tag, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

// ⚙️ System Validation Configuration
const CONFIG = {
  MAX_FILE_SIZE_MB: 50,
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 52,428,800 bytes
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp']
};

export function validateProfileMedia(file: File): { isValid: boolean; error?: string } {
  // 1. Enforce File Size Limit
  if (file.size > CONFIG.MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File size exceeds the global limit. Maximum allowed size is ${CONFIG.MAX_FILE_SIZE_MB} MB.`
    };
  }
  // 2. Enforce Restricted MIME Types
  const isValidMime = CONFIG.ALLOWED_MIME_TYPES.some((type) => {
    if (type.endsWith('/*')) {
      const baseType = type.split('/')[0];
      return file.type.startsWith(`${baseType}/`);
    }
    return file.type === type;
  });
  if (!isValidMime) {
    return {
      isValid: false,
      error: `Invalid file type (${file.type}). Only standard images (JPEG, PNG, WEBP) are allowed.`
    };
  }
  return { isValid: true };
}

interface ProfileDesignFormProps {
  userId: string;
  onUpdateSuccess?: () => void;
  onProfileUpdate?: (profileData: any) => void;
}

export function ProfileDesignForm({ userId, onUpdateSuccess, onProfileUpdate }: ProfileDesignFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [country, setCountry] = useState('United Kingdom');
  const [city, setCity] = useState('London, Mayfair');
  const [hourlyRate, setHourlyRate] = useState(250);
  const [selectedTags, setSelectedTags] = useState<string[]>(['#ELEGANCE', '#CHAMPAGNE']);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [companionAge, setCompanionAge] = useState('');
  const [companionHeight, setCompanionHeight] = useState('');
  const [companionBio, setCompanionBio] = useState('');

  // New tag input state
  const [newTagInput, setNewTagInput] = useState('');

  // 🟢 AUTOMATED MONITOR SYSTEM STATE
  const [isOnline, setIsOnline] = useState(true);

  // Monitor live ping simulation to show real-time status shifts
  useEffect(() => {
    const interval = setInterval(() => {
      setIsOnline(navigator.onLine);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Pre-load current profile values from Supabase profiles row
  useEffect(() => {
    async function loadProfile() {
      if (!userId) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('location, hourly_rate, tags, cover_image_url, title, bio, age, height')
          .eq('id', userId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          if (data.location) {
            const parts = data.location.split(',');
            if (parts.length > 1) {
              setCountry(parts[0].trim());
              setCity(parts.slice(1).join(',').trim());
            } else {
              setCountry('');
              setCity(data.location.trim());
            }
          }
          if (data.hourly_rate) setHourlyRate(Number(data.hourly_rate));
          if (Array.isArray(data.tags)) setSelectedTags(data.tags);
          if (data.title || data.bio) {
            const bioVal = data.bio || data.title || '';
            setCompanionBio(bioVal);
          }
          if (data.age) {
            setCompanionAge(String(data.age));
          }
          if (data.height) {
            setCompanionHeight(data.height);
          }
          if (data.cover_image_url) {
            setImagePreview(data.cover_image_url);
          }
        }
      } catch (err) {
        console.warn('Error loading companion profile properties:', err);
      }
    }
    loadProfile();
  }, [userId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErrorMessage(null);
    setSuccessMessage(null);

    if (file) {
      const check = validateProfileMedia(file);
      if (!check.isValid) {
        setErrorMessage(check.error || 'Upload validation failed.');
        e.target.value = ''; // Clear file input
        setImageFile(null);
        return;
      }

      setImageFile(file);
      // Generate standard object URL preview
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      console.log('File cleared for upload pipeline:', file.name);
    }
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    
    // Auto prefix with # if not present
    let formattedTag = newTagInput.trim().toUpperCase();
    if (!formattedTag.startsWith('#')) {
      formattedTag = `#${formattedTag}`;
    }

    if (!selectedTags.includes(formattedTag)) {
      setSelectedTags([...selectedTags, formattedTag]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      let uploadedImageUrl = null;

      // 1. Upload the image to Supabase Storage if a new one is selected
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${userId}-${Math.random()}.${fileExt}`;

        // Attempt upload with automatic bucket-creation fallback
        try {
          const { error: uploadError } = await supabase.storage
            .from('profile-media')
            .upload(fileName, imageFile, { upsert: true });

          if (uploadError) {
            // Bucket might not exist, attempt to create and retry
            console.log('Attempting self-healing bucket creation...');
            await supabase.storage.createBucket('profile-media', { public: true });
            
            // Retry upload
            const { error: retryError } = await supabase.storage
              .from('profile-media')
              .upload(fileName, imageFile, { upsert: true });

            if (retryError) throw retryError;
          }

          // Get public URL
          const { data: urlData } = supabase.storage.from('profile-media').getPublicUrl(fileName);
          uploadedImageUrl = urlData.publicUrl;
        } catch (storageErr: any) {
          console.warn('Supabase storage error (falling back to base64 preview storage):', storageErr);
          // Standard base64 fallback to keep the app functional even if storage permissions are restricted
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
          });
          reader.readAsDataURL(imageFile);
          uploadedImageUrl = await base64Promise;
        }
      }

      // 2. Save location, tags, rates, and image to the database profile row
      const combinedLocation = country.trim() ? `${country.trim()}, ${city.trim()}` : city.trim();

      const updateData: any = {
        location: combinedLocation,
        hourly_rate: hourlyRate,
        tags: selectedTags, // Array of strings e.g., ['#ELEGANCE', '#DANCE']
        title: companionBio,
        bio: companionBio,
        age: companionAge ? Number(companionAge) : null,
        height: companionHeight || null,
      };

      if (uploadedImageUrl) {
        updateData.cover_image_url = uploadedImageUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) throw error;

      // 🎯 PUSH UPDATE TO GLOBAL/LAYOUT STATE IF SPECIFIED
      if (onProfileUpdate) {
        onProfileUpdate({ bio: companionBio, country, city, age: companionAge, height: companionHeight });
      }

      setSuccessMessage('Companion profile updated successfully!');
      setImageFile(null); // Clear selected file
      
      if (onUpdateSuccess) {
        onUpdateSuccess();
      }
    } catch (err: any) {
      console.error('Error saving companion profile properties:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during saving.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="companion-profile-design-card" className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 max-w-full text-zinc-100 flex flex-col h-full justify-between">
      <div>
        <h3 className="text-white font-black text-sm uppercase font-mono tracking-wider flex items-center gap-2 mb-2">
          <Tag className="w-4.5 h-4.5 text-pink-500" />
          <span>Design Your Companions Profile</span>
        </h3>
        <p className="text-[11px] text-zinc-400 mb-4 leading-relaxed font-mono">
          Update your location coordinates, live rates, categories, and cover backdrop. Matches real-time verified directories.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 🔄 Replaced Companion Bio with the Creator Biography Style */}
          <div className="flex flex-col gap-1.5 mt-4">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 font-mono text-[11px]">
              Companion Biography
            </label>
            <textarea 
              placeholder="Write a detailed biography for your companion..." 
              value={companionBio}
              onChange={(e) => setCompanionBio(e.target.value)}
              rows={4}
              className="w-full bg-[#0a0512] border border-zinc-900 rounded-lg px-4 py-3 text-sm text-white focus:border-pink-500 transition-colors resize-none font-mono"
            />
          </div>

          {/* 🆕 Added Age & Height to Companion Profile Designer */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 font-mono text-[11px]">
                Age
              </label>
              <input 
                type="text" 
                placeholder="e.g. 24" 
                value={companionAge}
                onChange={(e) => setCompanionAge(e.target.value)}
                className="w-full bg-[#0a0512] border border-zinc-900 rounded-lg px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-pink-500 transition-colors font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 font-mono text-[11px]">
                Height
              </label>
              <input 
                type="text" 
                placeholder={"e.g. 5'7\" or 172cm"} 
                value={companionHeight}
                onChange={(e) => setCompanionHeight(e.target.value)}
                className="w-full bg-[#0a0512] border border-zinc-900 rounded-lg px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-pink-500 transition-colors font-mono"
              />
            </div>
          </div>

          {/* 🌍 Location Form Section */}
          <div className="flex flex-col gap-4">
            
            {/* Country Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Country</label>
              <input 
                type="text" 
                required
                value={country} 
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-[#0a0512] border border-zinc-900 rounded-xl px-4 py-3 text-sm text-white focus:border-[#ff2d55] outline-none font-mono"
                placeholder="e.g. United Kingdom"
              />
            </div>

            {/* City / Area Input (Now drops beautifully onto the next line) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono">City / Area Location</label>
              <input 
                type="text" 
                required
                value={city} 
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-[#0a0512] border border-zinc-900 rounded-xl px-4 py-3 text-sm text-white focus:border-[#ff2d55] outline-none font-mono"
                placeholder="e.g. London, Soho"
              />
            </div>

          </div>

          {/* Hourly Rate field */}
          <div>
            <label className="text-[10px] text-zinc-500 font-bold block mb-1 uppercase tracking-wider font-mono">💵 Hourly Booking Rate ($)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />
              <input
                type="number"
                required
                min={50}
                max={5000}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                placeholder="Hourly rate in USD"
                className="w-full bg-zinc-900 text-xs text-zinc-100 rounded-xl pl-9 pr-3 py-2.5 border border-zinc-800 focus:outline-none focus:border-pink-500 font-mono text-emerald-400 font-black"
              />
            </div>
          </div>

          {/* Tags & System Online Status Section */}
          <div className="space-y-3 pt-2">
            {/* 🟢 SYSTEM HARDWARE TRACKER STATUS BADGE */}
            <div className="flex items-center justify-between bg-[#111115] border border-zinc-850 rounded-xl p-3">
              <span className="text-[11px] font-black text-zinc-400 uppercase tracking-wider font-mono">Live Link Connection</span>
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full animate-pulse ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-zinc-600'}`} />
                <span className={`text-[10px] font-black tracking-widest uppercase font-mono ${isOnline ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
            </div>

            {/* 🏷️ STYLED COMPANION TAG SYSTEM MODULE */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">🏷️ Categories &amp; Tags</label>
                <span className="text-[10px] bg-pink-500/15 text-pink-400 font-mono font-black px-2 py-0.5 rounded-full">
                  {selectedTags.length} Active
                </span>
              </div>
              
              {/* Dynamic List Stream Container */}
              <div className="flex flex-wrap gap-2 py-1">
                {selectedTags.map((tag) => {
                  const displayTag = tag.startsWith('#') ? tag.substring(1) : tag;
                  return (
                    <div 
                      key={tag} 
                      className="flex items-center gap-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 px-3 py-1.5 rounded-full text-[11px] font-mono font-bold tracking-wide text-zinc-300 transition"
                    >
                      <span className="text-pink-500 font-black">#</span>
                      <span>{displayTag}</span>
                      <button 
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-zinc-600 hover:text-rose-400 font-bold text-xs ml-1 transition"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
                
                {selectedTags.length === 0 && (
                  <span className="text-xs text-zinc-600 italic font-mono">No category tags assigned yet.</span>
                )}
              </div>

              {/* Tag add block */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Add e.g. ELEGANCE, DANCE"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="flex-1 bg-zinc-950 text-xs text-zinc-100 rounded-xl px-3 py-2 border border-zinc-900 focus:outline-none focus:border-pink-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="bg-zinc-800 hover:bg-zinc-750 text-white font-mono font-bold text-xs px-3.5 rounded-xl transition border border-zinc-700"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>

          {/* Profile Cover Image input */}
          <div>
            <label className="text-[10px] text-zinc-500 font-bold block mb-1.5 uppercase tracking-wider font-mono">🖼️ Profile Cover Image</label>
            
            {imagePreview && (
              <div className="mb-2 relative rounded-xl overflow-hidden border border-zinc-800 h-28 bg-zinc-900">
                <img 
                  src={imagePreview} 
                  alt="Backdrop preview" 
                  className="w-full h-full object-cover" 
                />
                <div className="absolute top-2 right-2 bg-zinc-950/80 px-2 py-0.5 rounded text-[9px] font-mono text-zinc-400 border border-zinc-800">
                  Staged Preview
                </div>
              </div>
            )}

            <input 
              type="file" 
              accept="image/jpeg, image/png, image/webp"
              onChange={handleFileChange}
              className="w-full text-[10px] text-zinc-400 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-mono file:font-black file:bg-pink-600 file:text-white hover:file:bg-pink-700 pointer-events-auto cursor-pointer"
            />
            <p className="text-[9px] text-zinc-500 mt-1 font-mono">Max size: 50 MB. Formats: JPEG, PNG, WEBP.</p>
          </div>

          {/* Dynamic Error Feedback Alert */}
          {errorMessage && (
            <div className="bg-red-950/40 border border-red-800 text-red-400 text-xs p-3 rounded-xl font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Dynamic Success Alert */}
          {successMessage && (
            <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-400 text-xs p-3 rounded-xl font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:opacity-50 text-white font-extrabold text-xs py-3 rounded-xl transition flex items-center justify-center gap-2 shadow"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>SAVING CHANGES...</span>
              </>
            ) : (
              <span>SAVE PROFILE CHANGES</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
