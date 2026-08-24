import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface EditCompanionCardProps {
  userId: string;
}

export const EditCompanionCard: React.FC<EditCompanionCardProps> = ({ userId }) => {
  const [username, setUsername] = useState('');
  const [location, setLocation] = useState('');
  const [headline, setHeadline] = useState('');
  const [age, setAge] = useState<number | string>('');
  const [categoryTitle, setCategoryTitle] = useState('');
  const [tagsInput, setTagsInput] = useState(''); // Comma-separated string for tags

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load existing profile card data
  useEffect(() => {
    const fetchCompanionData = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from('companions')
          .select('username, location, headline, age, category_title, tags')
          .or(`user_id.eq.${userId},id.eq.${userId}`)
          .maybeSingle();

        if (error) {
          console.error('Error fetching card data:', error.message);
        } else if (data) {
          setUsername(data.username || '');
          setLocation(data.location || '');
          setHeadline(data.headline || '');
          setAge(data.age || '');
          setCategoryTitle(data.category_title || '');
          setTagsInput(data.tags ? data.tags.join(', ') : '');
        }
      } catch (err) {
        console.warn('Error fetching companion data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanionData();
  }, [userId]);

  // Handle saving all card updates
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    const numericAge = Number(age);
    if (numericAge < 18) {
      setStatusMsg({ type: 'error', text: 'Age must be 18 or older.' });
      return;
    }

    // Convert comma-separated string into clean uppercase tags without '#'
    const formattedTags = tagsInput
      .split(',')
      .map(tag => tag.trim().replace(/^#/, '').toUpperCase())
      .filter(tag => tag.length > 0);

    setSaving(true);

    try {
      const { error } = await supabase
        .from('companions')
        .update({
          username: username.trim().toLowerCase().replace(/^@/, ''), // Clean @ handle
          location: location.trim(),
          headline: headline.trim(),
          age: numericAge,
          category_title: categoryTitle.trim(),
          tags: formattedTags,
          updated_at: new Date().toISOString()
        })
        .or(`user_id.eq.${userId},id.eq.${userId}`);

      if (error) {
        console.error('Failed to update companion card:', error.message);
        setStatusMsg({ type: 'error', text: error.message });
      } else {
        setStatusMsg({ type: 'success', text: 'Profile card updated successfully!' });
      }
    } catch (err: any) {
      console.error('Exception updating companion card:', err);
      setStatusMsg({ type: 'error', text: err.message || 'Error updating profile card.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4 text-slate-400 font-mono text-sm">Loading profile data...</div>;

  return (
    <div className="max-w-lg p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4 shadow-2xl">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>✨</span> Edit Companion Card
        </h2>
        <p className="text-xs text-slate-400">Update how your card appears in the main directory.</p>
      </div>

      {statusMsg && (
        <div
          className={`p-3 text-sm rounded-lg ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Username / Handle */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Username Handle (@handle)
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. misscakes"
            className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-500 font-mono text-sm"
            required
          />
        </div>

        {/* Location & Age in 2 Columns */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. London, UK"
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-500 font-mono text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Age
            </label>
            <input
              type="number"
              min="18"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 24"
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-500 font-mono text-sm"
              required
            />
          </div>
        </div>

        {/* Headline / Bio Intro */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Headline / Bio Text
          </label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="e.g. Hey DM! If you wanna hang out with me."
            className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-500 text-sm"
            required
          />
        </div>

        {/* Category Title */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Category / Broadcaster Title
          </label>
          <input
            type="text"
            value={categoryTitle}
            onChange={(e) => setCategoryTitle(e.target.value)}
            placeholder="e.g. Lounge Live Broadcaster"
            className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-500 text-rose-400 font-medium text-sm"
          />
        </div>

        {/* Tags / Hashtags */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. ELEGANCE, CHAMPAGNE, VIP"
            className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-500 text-sm"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded-lg transition cursor-pointer"
        >
          {saving ? 'Updating Card...' : 'Save Card Changes'}
        </button>
      </form>
    </div>
  );
};
