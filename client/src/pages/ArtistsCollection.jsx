import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, TrendingUp, Search, Zap, BarChart3
} from 'lucide-react';
import { FaYoutube, FaInstagram, FaSpotify } from 'react-icons/fa';
import { NexusModal, Badge } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import NexusLoader from '../components/ui/NexusLoader';

const ArtistCard = ({ artist, onClick }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -10 }}
    onClick={() => onClick(artist._id)}
    className="bg-[var(--color-bg-surface)] rounded-[2.5rem] border border-[var(--color-bg-border)] overflow-hidden shadow-2xl shadow-black/5 cursor-pointer group flex flex-col h-full"
  >
    <div className="relative h-64 overflow-hidden">
      <img
        src={artist.profileImage || "/hnd-posing.jpeg"}
        alt={artist.name}
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
      <div className="absolute top-4 right-4">
        <Badge variant="todo" className="bg-white/10 backdrop-blur-md border-white/20 text-white">Active</Badge>
      </div>
      <div className="absolute bottom-6 left-8 right-8">
        <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic drop-shadow-xl">{artist.name}</h3>
        <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.3em] mt-1">Operational Artist Protocol</p>
      </div>
    </div>

    <div className="p-8 flex-1 flex flex-col justify-between space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-500 mb-1">
            <FaSpotify size={12} />
            <span className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Spotify</span>
          </div>
          <p className="text-sm font-black text-[var(--color-text-primary)]">{(artist.analytics?.spotify?.monthlyListeners / 1000).toFixed(1)}K</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-red-500 mb-1">
            <FaYoutube size={12} />
            <span className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">YouTube</span>
          </div>
          <p className="text-sm font-black text-[var(--color-text-primary)]">{(artist.analytics?.youtube?.views / 1000000).toFixed(1)}M</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-pink-500 mb-1">
            <FaInstagram size={12} />
            <span className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Insta</span>
          </div>
          <p className="text-sm font-black text-[var(--color-text-primary)]">{(artist.analytics?.instagram?.followers / 1000).toFixed(1)}K</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-[var(--color-bg-border)]">
        <div className="flex -space-x-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-6 h-6 rounded-full bg-[var(--color-bg-workspace)] border-2 border-[var(--color-bg-surface)] flex items-center justify-center">
              <Users size={10} className="text-[var(--color-text-muted)]" />
            </div>
          ))}
        </div>
        <button className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 transition-colors">
          Analyze Ecosystem <Zap size={10} fill="currentColor" />
        </button>
      </div>
    </div>
  </motion.div>
);

const ArtistsCollection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-8 pb-32 space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-[var(--color-text-primary)] uppercase tracking-tighter italic">Operational Roster</h1>
          <p className="text-[10px] text-[var(--color-text-muted)] font-black uppercase tracking-[0.4em] mt-2">Managing Excellence in Sound Ecosystems</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
          <div className="relative group flex-1 md:min-w-[300px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="SEARCH PROTOCOL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest text-[var(--color-text-primary)] outline-none focus:ring-4 focus:ring-blue-500/5 transition-all shadow-xl shadow-black/5"
            />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-3 bg-blue-500 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:shadow-2xl hover:shadow-blue-500/30 transition-all active:scale-95"
          >
            <Plus size={18} strokeWidth={3} /> Add Artist
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 md:gap-10">
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
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--color-text-muted)] opacity-50 italic">No artists matching protocol</p>
        </div>
      )}
    </div>
  );
};

export default ArtistsCollection;

