import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, ArrowLeft, Calendar, Music, Award, Users, 
  BarChart3, Globe, Heart, Eye, Share2, MoreVertical, 
  ChevronRight, ExternalLink, Zap, Target
} from 'lucide-react';
import { FaYoutube, FaInstagram, FaSpotify, FaStar } from 'react-icons/fa';
import NexusLoader from '../components/ui/NexusLoader';
import { Badge, NexusModal } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';

const StatCard = ({ label, value, icon: Icon, color, trend }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-[var(--color-bg-surface)] p-6 rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-xl shadow-black/5 space-y-4"
  >
    <div className="flex items-center justify-between">
      <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center text-white shadow-lg`}>
        <Icon size={24} />
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-emerald-500 font-black text-[10px] uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">
          <TrendingUp size={12} /> {trend}
        </div>
      )}
    </div>
    <div>
      <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em]">{label}</p>
      <h3 className="text-3xl font-black text-[var(--color-text-primary)] mt-1 tabular-nums">{value}</h3>
    </div>
  </motion.div>
);

const ArtistDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('analytics');
  const [isInjectModalOpen, setIsInjectModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    venue: '',
    audience: '',
    description: '',
    status: 'planned'
  });

  useEffect(() => {
    const fetchArtist = async () => {
      try {
        const res = await axios.get(`/api/artists/${id}`);
        setArtist(res.data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchArtist();
  }, [id]);

  const handleInjectEvent = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`/api/artists/${id}/inject-event`, newEvent);
      setArtist(res.data);
      setIsInjectModalOpen(false);
      setNewEvent({
        title: '',
        date: '',
        venue: '',
        audience: '',
        description: '',
        status: 'planned'
      });
    } catch (err) {
      console.error(err);
      alert('Failed to inject event');
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await axios.post(`/api/artists/${id}/sync-stats`);
      setArtist(res.data);
      setSyncing(false);
    } catch (err) {
      console.error(err);
      setSyncing(false);
      alert('Sync failed. Platforms might be blocking automated requests.');
    }
  };

  const DetailSkeleton = () => (
    <div className="max-w-[1600px] mx-auto px-6 py-8 pb-32 space-y-8 animate-pulse">
      <div className="h-6 w-32 bg-slate-200 rounded" />
      <div className="h-[400px] bg-slate-100 rounded-[3rem]" />
      <div className="grid grid-cols-4 gap-8">
        <div className="col-span-3 space-y-8">
          <div className="grid grid-cols-3 gap-6">
            <div className="h-40 bg-slate-100 rounded-[2.5rem]" />
            <div className="h-40 bg-slate-100 rounded-[2.5rem]" />
            <div className="h-40 bg-slate-100 rounded-[2.5rem]" />
          </div>
          <div className="h-96 bg-slate-100 rounded-[3rem]" />
        </div>
        <div className="space-y-8">
          <div className="h-80 bg-slate-100 rounded-[3rem]" />
          <div className="h-64 bg-slate-100 rounded-[3rem]" />
        </div>
      </div>
    </div>
  );

  if (loading) return <DetailSkeleton />;
  if (!artist) return <div className="p-20 text-center font-black uppercase tracking-widest text-rose-500">Artist Protocol Not Found</div>;

  const totalReach = (artist.analytics?.spotify?.followers || 0) + 
                    (artist.analytics?.youtube?.subscribers || 0) + 
                    (artist.analytics?.instagram?.followers || 0);

  const displayReach = totalReach >= 1000 ? `${(totalReach / 1000).toFixed(1)}K` : totalReach;

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8 pb-32 space-y-8">
      {/* Header / Nav */}
      <header className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/artists')}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all"
        >
          <ArrowLeft size={16} /> Back to Roster
        </button>
        <div className="flex items-center gap-4">
           <Badge variant="todo">Verified Artist</Badge>
           <button 
              onClick={handleSync}
              disabled={syncing}
              className={`p-2.5 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl hover:bg-[var(--color-bg-workspace)] transition-all ${syncing ? 'animate-pulse opacity-50' : ''}`}
           >
              <Zap size={18} className={syncing ? 'text-blue-500' : 'text-[var(--color-text-muted)]'} />
           </button>
           <button className="p-2.5 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl hover:bg-[var(--color-bg-workspace)] transition-all">
              <Share2 size={18} className="text-[var(--color-text-muted)]" />
           </button>
        </div>
      </header>

      {/* Hero Profile Section */}
      <section className="relative rounded-[2rem] md:rounded-[3rem] overflow-hidden bg-black aspect-video md:aspect-[21/9] lg:aspect-[25/7]">
         <img 
            src={artist.profileImage || "/hnd-posing.jpeg"} 
            alt={artist.name}
            className="w-full h-full object-cover opacity-60"
         />
         <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
         <div className="absolute bottom-6 left-6 right-6 md:bottom-12 md:left-12 md:right-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6 md:gap-8">
            <div className="space-y-4">
               <motion.h1 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-4xl md:text-6xl lg:text-8xl font-black text-white uppercase tracking-tighter italic"
               >
                  {artist.name}
               </motion.h1>
               <div className="flex flex-wrap gap-2 md:gap-3">
                  {artist.socials.spotify && (
                    <a href={artist.socials.spotify} target="_blank" rel="noopener" className="px-4 md:px-6 py-2 rounded-full bg-emerald-500/20 backdrop-blur-xl border border-emerald-500/30 text-emerald-400 font-black text-[8px] md:text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-500 hover:text-white transition-all">
                       <FaSpotify size={12} md:size={14} /> Spotify Artist
                    </a>
                  )}
                  {artist.socials.youtube && (
                    <a href={artist.socials.youtube} target="_blank" rel="noopener" className="px-4 md:px-6 py-2 rounded-full bg-red-500/20 backdrop-blur-xl border border-red-500/30 text-red-400 font-black text-[8px] md:text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-red-500 hover:text-white transition-all">
                       <FaYoutube size={12} md:size={14} /> YouTube Channel
                    </a>
                  )}
                  {artist.socials.instagram && (
                    <a href={artist.socials.instagram} target="_blank" rel="noopener" className="px-4 md:px-6 py-2 rounded-full bg-pink-500/20 backdrop-blur-xl border border-pink-500/30 text-pink-400 font-black text-[8px] md:text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-pink-500 hover:text-white transition-all">
                       <FaInstagram size={12} md:size={14} /> Instagram
                    </a>
                  )}
                  {artist.socials.instagramCollective && (
                    <a href={artist.socials.instagramCollective} target="_blank" rel="noopener" className="px-4 md:px-6 py-2 rounded-full bg-purple-500/20 backdrop-blur-xl border border-purple-500/30 text-purple-400 font-black text-[8px] md:text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-purple-500 hover:text-white transition-all">
                       <FaInstagram size={12} md:size={14} /> Collective
                    </a>
                  )}
               </div>
            </div>
            <div className="flex gap-4">
                <div className="p-4 md:p-6 bg-white/10 backdrop-blur-2xl rounded-[1.5rem] md:rounded-[2rem] border border-white/10 min-w-[140px] md:min-w-[200px]">
                  <p className="text-[8px] md:text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Collective Reach</p>
                  <p className="text-2xl md:text-4xl font-black text-white italic">{displayReach}</p>
               </div>
            </div>
         </div>
      </section>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
         <div className="lg:col-span-3 space-y-8">
            {/* Primary Metrics Hierarchy */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <StatCard 
                 label="Monthly Active Listeners" 
                 value={artist.analytics?.spotify?.mal?.toLocaleString() || artist.analytics?.spotify?.monthlyListeners?.toLocaleString()} 
                 icon={FaSpotify} 
                 color="bg-emerald-500"
                 trend={artist.analytics?.spotify?.streamsPerListener ? `${artist.analytics.spotify.streamsPerListener} streams/listener` : 'Stable Velocity'}
               />
               <StatCard 
                 label="YouTube Subscribers" 
                 value={artist.analytics?.youtube?.subscribers?.toLocaleString()} 
                 icon={FaYoutube} 
                 color="bg-red-500"
                 trend={artist.analytics?.youtube?.avd ? `AVD: ${artist.analytics.youtube.avd}` : 'Steady Growth'}
               />
               <StatCard 
                 label="Instagram Followers" 
                 value={artist.analytics?.instagram?.followers?.toLocaleString()} 
                 icon={FaInstagram} 
                 color="bg-pink-500"
                 trend={artist.analytics?.instagram?.followerVelocity ? `${artist.analytics.instagram.followerVelocity}% Growth Velocity` : 'Consistent Engagement'}
               />
            </div>

            {/* Event Timeline Intelligence */}
            <div className="bg-[var(--color-bg-surface)] rounded-[3rem] border border-[var(--color-bg-border)] overflow-hidden">
               <div className="p-8 border-b border-[var(--color-bg-border)] flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-[var(--color-text-primary)] uppercase tracking-tight italic">Mission Timeline</h3>
                    <p className="text-[10px] text-[var(--color-text-muted)] font-black uppercase tracking-widest mt-1">Operational Event History</p>
                  </div>
                   <button 
                    onClick={() => setIsInjectModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-500 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:shadow-xl hover:shadow-blue-500/20 transition-all"
                   >
                    <Zap size={14} strokeWidth={3} /> Inject Event
                  </button>
               </div>
               <div className="p-8 space-y-6">
                  {artist.events?.map((ev, i) => (
                    <div key={i} className="flex gap-6 group">
                       <div className="flex flex-col items-center">
                          <div className="w-12 h-12 rounded-2xl bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                             <Calendar size={20} />
                          </div>
                          {i !== artist.events.length - 1 && <div className="w-px h-full bg-[var(--color-bg-border)] my-2" />}
                       </div>
                       <div className="flex-1 pb-6">
                          <div className="flex items-start justify-between">
                             <div>
                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{ev.date}</p>
                                <h4 className="text-xl font-black text-[var(--color-text-primary)] mt-1">{ev.title}</h4>
                                <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-widest mt-1">{ev.venue} • {ev.audience}</p>
                             </div>
                             <Badge variant="todo">{ev.status}</Badge>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* Catalogue Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-[var(--color-bg-surface)] p-8 rounded-[3rem] border border-[var(--color-bg-border)]">
                  <h3 className="text-xl font-black text-[var(--color-text-primary)] uppercase tracking-tight italic mb-6">Discography Protocol</h3>
                  <div className="space-y-4">
                     {artist.discography?.map((song, i) => (
                       <div key={i} className="p-4 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl flex items-center justify-between hover:border-emerald-500 transition-all group">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-emerald-500">
                                <Music size={18} />
                             </div>
                             <div>
                                <p className="text-sm font-black text-[var(--color-text-primary)]">{song.title}</p>
                                <p className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest">{song.type}</p>
                             </div>
                          </div>
                          <a href={song.spotify} target="_blank" rel="noopener" className="w-8 h-8 rounded-full border border-[var(--color-bg-border)] flex items-center justify-center hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all">
                             <FaSpotify size={14} />
                          </a>
                       </div>
                     ))}
                  </div>
               </div>
               
               <div className="bg-[var(--color-bg-surface)] p-8 rounded-[3rem] border border-[var(--color-bg-border)]">
                  <h3 className="text-xl font-black text-[var(--color-text-primary)] uppercase tracking-tight italic mb-6">Growth Velocity</h3>
                  <div className="space-y-6">
                     <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                           <span>Follower Velocity (30d)</span>
                           <span className="text-blue-500">{artist.analytics?.instagram?.followerVelocity || 12}%</span>
                        </div>
                        <div className="w-full h-2 bg-[var(--color-bg-workspace)] rounded-full overflow-hidden">
                           <div className="h-full bg-blue-500" style={{ width: `${artist.analytics?.instagram?.followerVelocity || 12}%` }} />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                           <span>Audience Quality</span>
                           <span className="text-emerald-500">{artist.analytics?.instagram?.audienceQuality || 88}%</span>
                        </div>
                        <div className="w-full h-2 bg-[var(--color-bg-workspace)] rounded-full overflow-hidden">
                           <div className="h-full bg-emerald-500" style={{ width: `${artist.analytics?.instagram?.audienceQuality || 88}%` }} />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                           <span>Conversion Protocol (Profile Visits)</span>
                           <span className="text-purple-500">{(artist.analytics?.instagram?.profileVisitRatio * 100).toFixed(1) || 15}%</span>
                        </div>
                        <div className="w-full h-2 bg-[var(--color-bg-workspace)] rounded-full overflow-hidden">
                           <div className="h-full bg-purple-500" style={{ width: `${(artist.analytics?.instagram?.profileVisitRatio * 100) || 15}%` }} />
                        </div>
                     </div>
                  </div>
                  <div className="mt-12 p-6 bg-blue-500/5 rounded-3xl border border-blue-500/10">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center text-white">
                           <Target size={16} />
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-tight">Projected Growth Velocity</p>
                           <p className="text-[9px] text-[var(--color-text-muted)] font-bold uppercase mt-1">Based on current conversion of {((artist.analytics?.instagram?.profileVisitRatio || 0.15) * 100).toFixed(1)}%</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Right Sidebar Intelligence */}
         <div className="space-y-8">
            <div className="bg-[var(--color-bg-surface)] p-8 rounded-[3rem] border border-[var(--color-bg-border)] space-y-6">
               <div>
                  <h4 className="text-sm font-black text-[var(--color-text-primary)] uppercase tracking-widest italic">Core Bio</h4>
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mt-4">
                     {artist.bio}
                  </p>
               </div>
               <div className="pt-6 border-t border-[var(--color-bg-border)] space-y-4">
                  <h4 className="text-[10px] font-black text-[var(--color-text-primary)] uppercase tracking-widest">Digital Footprint</h4>
                  <div className="space-y-3">
                     <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--color-text-muted)]">Verified Status</span>
                        <span className="text-emerald-500 font-bold uppercase tracking-widest text-[9px]">Active</span>
                     </div>
                     <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--color-text-muted)]">Contracted Until</span>
                        <span className="text-[var(--color-text-primary)] font-bold">DEC 2026</span>
                     </div>
                     <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--color-text-muted)]">Primary Genre</span>
                        <span className="text-[var(--color-text-primary)] font-bold uppercase tracking-widest text-[9px]">Classical Fusion</span>
                     </div>
                  </div>
               </div>
               <button className="w-full py-4 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl text-[10px] font-black uppercase tracking-widest text-[var(--color-text-primary)] hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all">
                  Edit Artist Profile
               </button>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[3rem] text-white space-y-6 shadow-2xl shadow-blue-500/20">
               <h4 className="text-xl font-black uppercase tracking-tight italic">Operational Health</h4>
               <div className="flex items-center gap-4">
                  <div className="text-4xl font-black italic">A+</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">System sync optimal</div>
               </div>
               <div className="space-y-4">
                  <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Last Audit</p>
                     <p className="text-xs font-bold mt-1">2 hours ago</p>
                  </div>
                  <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Assigned Team</p>
                     <p className="text-xs font-bold mt-1">Operational Nexus</p>
                  </div>
               </div>
            </div>
         </div>
      </div>

      <NexusModal
        isOpen={isInjectModalOpen}
        onClose={() => setIsInjectModalOpen(false)}
        title="Inject Operational Event"
      >
        <form onSubmit={handleInjectEvent} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Event Title</label>
              <input 
                type="text" 
                required
                className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl p-3 text-xs text-[var(--color-text-primary)]"
                value={newEvent.title}
                onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                placeholder="e.g. Festival Performance"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Date</label>
              <input 
                type="date" 
                required
                className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl p-3 text-xs text-[var(--color-text-primary)]"
                value={newEvent.date}
                onChange={e => setNewEvent({...newEvent, date: e.target.value})}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Venue</label>
              <input 
                type="text" 
                className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl p-3 text-xs text-[var(--color-text-primary)]"
                value={newEvent.venue}
                onChange={e => setNewEvent({...newEvent, venue: e.target.value})}
                placeholder="e.g. O2 Arena"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Audience</label>
              <input 
                type="text" 
                className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl p-3 text-xs text-[var(--color-text-primary)]"
                value={newEvent.audience}
                onChange={e => setNewEvent({...newEvent, audience: e.target.value})}
                placeholder="e.g. 50,000+"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Description</label>
            <textarea 
              className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl p-3 text-xs text-[var(--color-text-primary)] min-h-[100px]"
              value={newEvent.description}
              onChange={e => setNewEvent({...newEvent, description: e.target.value})}
              placeholder="Operational details..."
            />
          </div>
          <button 
            type="submit"
            className="w-full py-4 bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:shadow-2xl hover:shadow-blue-500/30 transition-all"
          >
            Confirm Protocol Injection
          </button>
        </form>
      </NexusModal>
    </div>
  );
};

export default ArtistDetail;
