import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Search, Zap, BarChart3, Info
} from 'lucide-react';
import { FaYoutube, FaInstagram, FaSpotify } from 'react-icons/fa';
import { NexusModal, Badge, PageHeader, PageContainer, Card, InfoButton } from "../../components/ui";

const getArtistEmoji = (name = '') => {
  if (name.includes('Yugm')) return '🎸';
  if (name.includes('Mohit')) return '🎤';
  if (name.includes('Harshad')) return '🎵';
  return '✨';
};

const ArtistCard = ({ artist, onClick }) => {
  const isSynced = artist.isSynced;
  const spotifyVal = isSynced ? (artist.analytics?.spotify?.monthlyListeners ?? artist.analytics?.spotify?.mal) : null;
  const displaySpotify = (isSynced && spotifyVal != null && spotifyVal > 0) ? (spotifyVal >= 1000 ? `${(spotifyVal / 1000).toFixed(1)}K` : spotifyVal) : 'N/A';

  const ytVal = isSynced ? artist.analytics?.youtube?.views : null;
  const displayYt = (isSynced && ytVal != null && ytVal > 0) ? (ytVal >= 1000000 ? `${(ytVal / 1000000).toFixed(1)}M` : (ytVal >= 1000 ? `${(ytVal / 1000).toFixed(1)}K` : ytVal)) : 'N/A';

  const igVal = isSynced ? artist.analytics?.instagram?.followers : null;
  const displayIg = (isSynced && igVal != null && igVal > 0) ? (igVal >= 1000 ? `${(igVal / 1000).toFixed(1)}K` : igVal) : 'N/A';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8 }}
      onClick={() => onClick(artist._id)}
      className="group flex flex-col h-full cursor-pointer"
    >
      <Card className="overflow-hidden shadow-xl shadow-black/5 flex flex-col h-full bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] transition-all hover:border-[var(--color-action-primary)]/40" hover>
        <div className="relative h-64 overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center border-b border-[var(--color-bg-border)] p-4">
          <motion.div 
            className="text-8xl select-none filter drop-shadow-2xl"
            whileHover={{ scale: 1.2, rotate: [0, -5, 5, 0] }}
            transition={{ duration: 0.4 }}
          >
            {getArtistEmoji(artist.name)}
          </motion.div>
          <div className="absolute top-4 right-4">
            <Badge variant="success" className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black text-[10px] px-3 py-1">Active Roster</Badge>
          </div>
          <div className="absolute bottom-4 left-6 right-6">
            <h3 className="text-3xl font-black text-white uppercase tracking-tight truncate drop-shadow">{artist.name}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Verified Profile</p>
          </div>
        </div>

        <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] space-y-1">
              <div className="flex items-center justify-between text-emerald-500 mb-1">
                <div className="flex items-center gap-1.5">
                  <FaSpotify size={12} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Spotify</span>
                </div>
                <InfoButton text="Monthly Active Listeners on Spotify platform" />
              </div>
              <div className="flex items-center gap-1">
                <p className="text-sm font-black text-[var(--color-text-primary)] tabular-nums">{displaySpotify}</p>
                {!isSynced && <InfoButton text="To link Spotify: Go to Spotify for Artists or Chartmetric, copy your Artist ID from the URL (e.g., 6L88xirodmb...WYo), and enter it in Settings -> Link Platforms to enable live API feeds." />}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] space-y-1">
              <div className="flex items-center justify-between text-red-500 mb-1">
                <div className="flex items-center gap-1.5">
                  <FaYoutube size={12} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">YouTube</span>
                </div>
                <InfoButton text="Total channel video views on YouTube" />
              </div>
              <div className="flex items-center gap-1">
                <p className="text-sm font-black text-[var(--color-text-primary)] tabular-nums">{displayYt}</p>
                {!isSynced && <InfoButton text="To link YouTube: Go to YouTube Studio -> Settings -> Channel -> Advanced, copy your Channel ID (e.g., UC_x5XG...), and connect via OAuth in Settings." />}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] space-y-1">
              <div className="flex items-center justify-between text-pink-500 mb-1">
                <div className="flex items-center gap-1.5">
                  <FaInstagram size={12} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Insta</span>
                </div>
                <InfoButton text="Instagram professional account followers" />
              </div>
              <div className="flex items-center gap-1">
                <p className="text-sm font-black text-[var(--color-text-primary)] tabular-nums">{displayIg}</p>
                {!isSynced && <InfoButton text="To link Meta: Connect your Instagram Professional / Facebook Business page via Meta Graph API in Settings to activate real-time tracking." />}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[var(--color-bg-border)]">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Multi-Platform Linked</span>
            <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 transition-colors">
              View Analytics <Zap size={12} fill="currentColor" />
            </button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

const ArtistsCollection = () => {
  const navigate = useNavigate();
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [newArtist, setNewArtist] = useState({
    name: '', bio: '', website: '',
    spotifyUrl: '', spotifyId: '',
    youtubeUrl: '', youtubeId: '',
    instaUrl: '', instaId: '',
    fbUrl: '', fbId: ''
  });

  const fetchArtists = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/artists');
      setArtists(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtists();
  }, []);

  const handleAddArtist = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: newArtist.name,
        bio: newArtist.bio || `${newArtist.name} official artist profile and analytics.`,
        profileImage: '/hnd-posing.jpeg',
        website: newArtist.website,
        socials: {
          spotify: newArtist.spotifyUrl,
          youtube: newArtist.youtubeUrl,
          instagram: newArtist.instaUrl,
          facebook: newArtist.fbUrl
        },
        oauthCredentials: {
          spotify: { artistId: newArtist.spotifyId },
          youtube: { channelId: newArtist.youtubeId ? (newArtist.youtubeId.startsWith('UC') ? newArtist.youtubeId : 'UC' + newArtist.youtubeId) : undefined },
          meta: { igAccountId: newArtist.instaId, fbPageId: newArtist.fbId }
        }
      };
      await axios.post('/api/artists', payload);
      setIsAddModalOpen(false);
      setNewArtist({
        name: '', bio: '', website: '',
        spotifyUrl: '', spotifyId: '',
        youtubeUrl: '', youtubeId: '',
        instaUrl: '', instaId: '',
        fbUrl: '', fbId: ''
      });
      fetchArtists();
    } catch (err) {
      alert('Failed to add artist: ' + (err.response?.data?.message || err.message));
    }
  };

  const ArtistSkeleton = () => (
    <div className="bg-[var(--color-bg-surface)] rounded-[2.5rem] border border-[var(--color-bg-border)] overflow-hidden shadow-2xl shadow-black/5 animate-pulse h-[450px]">
      <div className="h-64 bg-slate-200" />
      <div className="p-8 space-y-6">
        <div className="h-8 bg-slate-200 rounded-xl w-3/4" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-10 bg-slate-100 rounded-lg" />
          <div className="h-10 bg-slate-100 rounded-lg" />
          <div className="h-10 bg-slate-100 rounded-lg" />
        </div>
      </div>
    </div>
  );

  const filteredArtists = artists.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <PageContainer>
      <PageHeader
        title="Artists Roster"
        subtitle="Manage artist profiles, OAuth keys, and multi-platform analytics."
        icon={Users}
        actions={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
            <div className="relative group flex-1 md:min-w-[300px]">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="Search artists..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[10px] font-black uppercase tracking-widest text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-action-primary)] transition-all shadow-inner"
              />
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center justify-center gap-3 bg-[var(--color-action-primary)] text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[var(--color-action-hover)] transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              <Plus size={18} strokeWidth={3} /> Add Artist
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {loading ? (
          <>
            <ArtistSkeleton />
            <ArtistSkeleton />
            <ArtistSkeleton />
          </>
        ) : (
          <AnimatePresence>
            {filteredArtists.map(artist => (
              <ArtistCard key={artist._id} artist={artist} onClick={(id) => navigate(`/artists/${id}`)} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {filteredArtists.length === 0 && (
        <div className="flex flex-col items-center justify-center py-40 bg-[var(--color-bg-surface)] rounded-[4rem] border border-[var(--color-bg-border)] border-dashed">
          <div className="w-20 h-20 rounded-[2rem] bg-[var(--color-bg-workspace)] flex items-center justify-center mb-6">
            <BarChart3 size={32} className="text-[var(--color-text-muted)] opacity-20" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--color-text-muted)] opacity-50 italic">No artists found in roster</p>
        </div>
      )}

      <NexusModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Artist Profile & Credentials"
      >
        <form onSubmit={handleAddArtist} className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-action-primary)] border-b border-[var(--color-bg-border)] pb-2">1. General Info</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Artist Name *</label>
                <input
                  type="text"
                  required
                  value={newArtist.name}
                  onChange={e => setNewArtist({ ...newArtist, name: e.target.value })}
                  placeholder="e.g. Yugm"
                  className="w-full p-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Website URL</label>
                <input
                  type="url"
                  value={newArtist.website}
                  onChange={e => setNewArtist({ ...newArtist, website: e.target.value })}
                  placeholder="https://..."
                  className="w-full p-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] outline-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Bio</label>
              <textarea
                value={newArtist.bio}
                onChange={e => setNewArtist({ ...newArtist, bio: e.target.value })}
                placeholder="Artist background..."
                className="w-full p-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] outline-none min-h-[80px]"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[var(--color-bg-border)]">
            <h4 className="text-xs font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2 border-b border-[var(--color-bg-border)] pb-2">
              <FaSpotify size={16} /> 2. Spotify API Linking
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Spotify Profile URL</label>
                <input
                  type="url"
                  value={newArtist.spotifyUrl}
                  onChange={e => setNewArtist({ ...newArtist, spotifyUrl: e.target.value })}
                  placeholder="https://open.spotify.com/artist/..."
                  className="w-full p-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1.5">
                  Spotify Artist ID <span title="Extract 22 alphanumeric base62 chars from profile URL after /artist/" className="cursor-help text-emerald-500"><Info size={12} /></span>
                </label>
                <input
                  type="text"
                  value={newArtist.spotifyId}
                  onChange={e => setNewArtist({ ...newArtist, spotifyId: e.target.value })}
                  placeholder="e.g. 43uEANXUn0eOJrYKfjq2DL"
                  className="w-full p-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold font-mono text-[var(--color-text-primary)] outline-none"
                />
              </div>
            </div>
            <p className="text-[9px] text-[var(--color-text-muted)] flex items-center gap-1 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10 font-semibold">
              <Info size={12} className="text-emerald-500 shrink-0" />
              Tip: In Spotify desktop app, click Three Dots (...) &gt; Share &gt; Copy link to artist. The ID is the 22 characters between /artist/ and ?.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-[var(--color-bg-border)]">
            <h4 className="text-xs font-black uppercase tracking-widest text-red-500 flex items-center gap-2 border-b border-[var(--color-bg-border)] pb-2">
              <FaYoutube size={16} /> 3. YouTube API Linking
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">YouTube Channel URL</label>
                <input
                  type="url"
                  value={newArtist.youtubeUrl}
                  onChange={e => setNewArtist({ ...newArtist, youtubeUrl: e.target.value })}
                  placeholder="https://www.youtube.com/@..."
                  className="w-full p-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1.5">
                  YouTube Channel ID <span title="Starts with UC (24 characters). Do not use @handle." className="cursor-help text-red-500"><Info size={12} /></span>
                </label>
                <input
                  type="text"
                  value={newArtist.youtubeId}
                  onChange={e => setNewArtist({ ...newArtist, youtubeId: e.target.value })}
                  placeholder="e.g. UCWtslmKHX8dly9BWdfnazFA"
                  className="w-full p-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold font-mono text-[var(--color-text-primary)] outline-none"
                />
              </div>
            </div>
            <p className="text-[9px] text-[var(--color-text-muted)] flex items-center gap-1 bg-red-500/5 p-2 rounded-lg border border-red-500/10 font-semibold">
              <Info size={12} className="text-red-500 shrink-0" />
              Tip: Go to channel page, view page source (Ctrl+U), search for &quot;externalId&quot; to copy the 24-character UC... identifier.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-[var(--color-bg-border)]">
            <h4 className="text-xs font-black uppercase tracking-widest text-pink-500 flex items-center gap-2 border-b border-[var(--color-bg-border)] pb-2">
              <FaInstagram size={16} /> 4. Meta (IG &amp; FB) API Linking
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Instagram Profile URL</label>
                <input
                  type="url"
                  value={newArtist.instaUrl}
                  onChange={e => setNewArtist({ ...newArtist, instaUrl: e.target.value })}
                  placeholder="https://instagram.com/..."
                  className="w-full p-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1.5">
                  IG Graph ID <span title="17-digit numeric ID from Meta Graph API Explorer" className="cursor-help text-pink-500"><Info size={12} /></span>
                </label>
                <input
                  type="text"
                  value={newArtist.instaId}
                  onChange={e => setNewArtist({ ...newArtist, instaId: e.target.value })}
                  placeholder="e.g. 17841458291039201"
                  className="w-full p-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold font-mono text-[var(--color-text-primary)] outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Facebook Page URL</label>
                <input
                  type="url"
                  value={newArtist.fbUrl}
                  onChange={e => setNewArtist({ ...newArtist, fbUrl: e.target.value })}
                  placeholder="https://facebook.com/..."
                  className="w-full p-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1.5">
                  FB Page ID <span title="15-digit numeric ID from Meta Graph API Explorer" className="cursor-help text-blue-500"><Info size={12} /></span>
                </label>
                <input
                  type="text"
                  value={newArtist.fbId}
                  onChange={e => setNewArtist({ ...newArtist, fbId: e.target.value })}
                  placeholder="e.g. 109281928392019"
                  className="w-full p-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold font-mono text-[var(--color-text-primary)] outline-none"
                />
              </div>
            </div>
            <p className="text-[9px] text-[var(--color-text-muted)] flex items-center gap-1 bg-pink-500/5 p-2 rounded-lg border border-pink-500/10 font-semibold">
              <Info size={12} className="text-pink-500 shrink-0" />
              Tip: Run me/accounts?fields=id,instagram_business_account in Meta Graph Explorer to instantly get both your 15-digit Page ID and 17-digit Instagram Professional ID.
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-[var(--color-action-primary)] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[var(--color-action-hover)] transition-all shadow-xl shadow-blue-500/20 active:scale-98 mt-6"
          >
            Create &amp; Initialize Roster Profile
          </button>
        </form>
      </NexusModal>
    </PageContainer>
  );
};

export default ArtistsCollection;
