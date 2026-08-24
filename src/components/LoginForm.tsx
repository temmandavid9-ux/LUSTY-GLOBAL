import { useState } from 'react';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { LustyGlobalLogo } from './LustyGlobalLogo';
import { supabase } from '../lib/supabase';

interface LoginFormProps {
  onLoginSuccess: (username: string, avatar: string, userId: string) => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const referredBy = typeof window !== 'undefined' ? localStorage.getItem('referred_by_host') : null;

  const handleAuthentication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please provide all credentials.');
      return;
    }

    if (isSignUp && !name.trim()) {
      setError('Full Name is required for registration.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError('');
    setLoading(true);

    // If email doesn't have an @, make it a fallback username email
    let userEmail = email.trim();
    if (!userEmail.includes('@')) {
      const cleanUsername = userEmail.toLowerCase().replace(/\s+/g, '');
      userEmail = `${cleanUsername}@fittrust.com`;
    }

    const fallbackAvatar = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`;

    try {
      if (isSignUp) {
        // 🚀 FIRST TIME REGISTRATION
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: userEmail,
          password: password,
          options: {
            data: {
              full_name: name.trim(),
            }
          }
        });

        if (signUpError) throw signUpError;
        if (!authData.user) throw new Error("Registration failed.");

        // Clean username for profile row
        const computedUsername = name.trim().toLowerCase().replace(/\s+/g, '') || userEmail.split('@')[0];

        // Create permanent profiles row mapping
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            { 
              id: authData.user.id, 
              username: computedUsername, 
              email: userEmail,
              current_balance: 1450.00,
              is_verified: false,
              bio: 'Verified VIP guest. Rates available on demand 🔒'
            }
          ]);

        if (profileError) {
          console.warn("Profile mapping failed/already exists:", profileError);
        }

        // 3️⃣ 🎯 THE REFERRAL LOOP: Check if they came from a Host's promo link
        const referredByHost = localStorage.getItem('referred_by_host');
        if (referredByHost) {
          try {
            // Find that host's exact ID using their username
            const { data: hostProfile } = await supabase
              .from('profiles')
              .select('id')
              .eq('username', referredByHost)
              .maybeSingle();

            if (hostProfile?.id) {
              // Automatically make them a fan/follower of that host in the DB
              await supabase
                .from('user_followers')
                .insert([
                  { 
                    following_id: hostProfile.id, 
                    follower_id: authData.user.id
                  }
                ]);
              
              console.log(`🔗 Successfully linked new fan to host: @${referredByHost}`);
              
              // Clear the tracking cookie now that the connection is permanently saved
              localStorage.removeItem('referred_by_host');
            }
          } catch (referralErr) {
            console.warn("Referral tracking lookup/association failed:", referralErr);
          }
        }

        alert('Registration successful! Launching secure session...');
        onLoginSuccess(computedUsername, fallbackAvatar, authData.user.id);
      } else {
        // 🔑 RETURN LOGIN
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: password,
        });

        if (signInError) throw signInError;
        if (!authData.user) throw new Error("User session creation aborted.");

        // Fetch their saved profile variables from the database
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', authData.user.id)
          .maybeSingle();

        const finalUsername = profileData?.username || userEmail.split('@')[0];
        const finalAvatar = profileData?.avatar_url || fallbackAvatar;

        onLoginSuccess(finalUsername, finalAvatar, authData.user.id);
      }
    } catch (err: any) {
      console.warn("Auth pipeline error intercepted:", err);
      const isNetworkError = err?.message?.includes('Failed to fetch') || 
                            err?.message?.includes('fetch') || 
                            err?.toString()?.includes('fetch') ||
                            err?.message?.includes('Network');
      if (isNetworkError) {
        setError('Connection Blocked (e.g. adblocker or tracker blocker). Click the "Enter Offline Demo Mode" button below to bypass and test the application instantly!');
      } else {
        setError(err.message || 'Authentication pipeline transaction failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineMode = () => {
    const fallbackUser = name.trim() || email.trim().split('@')[0] || 'Guest_VIP';
    const computedId = "offline_" + Math.random().toString(36).substr(2, 9);
    onLoginSuccess(fallbackUser, `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150`, computedId);
  };

  return (
    <div className="bg-[#0c0c0e] border border-zinc-900 rounded-3xl p-8 max-w-sm w-full font-sans text-white text-left shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-purple-500" />
      
      <div className="mb-6 text-center">
        {/* ── 📱 UNIFIED LOGO BLOCK (MOBILE FRIENDLY) ── */}
        <div className="flex items-center justify-center gap-2 select-none mb-3">
          <LustyGlobalLogo size="sm" />
        </div>
        <h2 className="text-xl font-black uppercase tracking-wider text-white">
          {isSignUp ? 'Create VIP Account' : 'Welcome Back'}
        </h2>
        <p className="text-[11px] text-zinc-500 mt-1">
          {isSignUp ? 'Enter details to claim your companion access' : 'Enter login credentials to proceed'}
        </p>
      </div>

      {referredBy && (
        <div className="bg-pink-950/20 border border-pink-500/30 text-pink-400 font-sans text-[11px] font-bold p-2.5 rounded-xl mb-4 flex items-center gap-2">
          <span className="animate-pulse">✨</span>
          <span>Referred by: <span className="text-white font-black">@{referredBy}</span></span>
        </div>
      )}

      {error && (
        <div className="bg-red-950/40 border border-red-900/50 text-red-400 font-mono text-[10px] p-3 rounded-xl mb-4 flex flex-col gap-2">
          <span>⚠️ {error}</span>
          {(error.includes('Blocked') || error.includes('fetch') || error.includes('Connection')) && (
            <button
              type="button"
              onClick={handleOfflineMode}
              className="mt-1 w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-extrabold text-[10px] py-2 rounded-lg transition duration-200 text-center uppercase tracking-wider cursor-pointer"
            >
              🚀 Enter Offline Demo Mode
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleAuthentication} className="space-y-4">
        {/* 📝 CONDITIONAL FULL NAME FIELD (Only displays during Sign Up) */}
        {isSignUp && (
          <div>
            <label className="block text-[10px] uppercase font-black tracking-wider text-zinc-400 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                required
                disabled={loading}
                placeholder="David Emmanuel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-900 focus:border-zinc-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none transition"
              />
            </div>
          </div>
        )}

        {/* ── Updated Login Identifier Label ── */}
        <div className="flex flex-col gap-1.5 mb-4">
          <h1 className="text-xs font-black uppercase tracking-wider text-zinc-400">
            USERNAME / EMAIL ADDRESS
          </h1>
          
          <div className="relative flex items-center">
            {/* Email/User Icon Wrapper */}
            <span className="absolute left-3 text-zinc-500">
              <svg className="w-4 h-4 stroke-current fill-none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
              </svg>
            </span>

            <input 
              type="text"
              placeholder="lucy@example.com or username"
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl pl-10 pr-3.5 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-pink-500 transition"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {/* 🔒 PASSWORD FIELD (Displays on BOTH Sign Up and Login) */}
        <div>
          <label className="block text-[10px] uppercase font-black tracking-wider text-zinc-400 mb-1.5">
            Email Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              disabled={loading}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-900 focus:border-zinc-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none transition"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-zinc-350"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* SUBMIT TRIGGER */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#ff007f] hover:bg-[#e0006f] disabled:bg-zinc-900 text-white font-black text-xs uppercase tracking-widest rounded-xl py-3 mt-2 transition duration-200 active:scale-95 shadow-lg shadow-pink-500/10"
        >
          {loading ? 'Processing Access...' : isSignUp ? 'Register Account' : 'Secure Login'}
        </button>
      </form>

      {/* TOGGLE BUTTON: Changes between Sign Up state and Login state */}
      <div className="mt-6 text-center pt-4 border-t border-zinc-900/60">
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError('');
          }}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition"
        >
          {isSignUp ? 'Already have an account? Login here' : "First time here? Sign up now"}
        </button>
      </div>
    </div>
  );
}
