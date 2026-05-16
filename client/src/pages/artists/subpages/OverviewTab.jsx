import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Music, Target, TrendingUp, Zap, Globe } from 'lucide-react';
import { FaSpotify, FaYoutube, FaInstagram } from 'react-icons/fa';
import { Badge, NexusModal, InfoButton } from '../../../components/ui';
import axios from 'axios';

const StatCard = ({ label, value, icon: Icon, color, trend, tooltip }) => (
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
      <div className="flex items-center gap-1.5">
        <p className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em]">{label}</p>
        {tooltip && <InfoButton text={tooltip} />}
      </div>
      <h3 className="text-3xl font-black text-[var(--color-text-primary)] mt-1 tabular-nums">{value}</h3>
    </div>
  </motion.div>
);

const OverviewTab = ({ artist, onUpdateArtist }) => {
  const [isInjectModalOpen, setIsInjectModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '', date: '', venue: '', audience: '', description: '', status: 'planned'
  });

  const handleInjectEvent = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`/api/artists/${artist._id}/inject-event`, newEvent);
      onUpdateArtist(res.data);
      setIsInjectModalOpen(false);
      setNewEvent({ title: '', date: '', venue: '', audience: '', description: '', status: 'planned' });
    } catch (err) {
      console.error(err);
      alert('Failed to inject event');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-3 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            label="Monthly Listeners" 
            value={artist.isSynced && (artist.analytics?.spotify?.mal != null || artist.analytics?.spotify?.monthlyListeners != null) ? (artist.analytics?.spotify?.mal ?? artist.analytics?.spotify?.monthlyListeners).toLocaleString() : 'N/A'} 
            icon={FaSpotify} 
            color="bg-emerald-500"
            trend={artist.isSynced && artist.analytics?.spotify?.streamsPerListener ? `${artist.analytics.spotify.streamsPerListener} streams/listener` : null}
            tooltip={!artist.isSynced ? "To link Spotify: Connect your Spotify for Artists or Chartmetric ID in Settings -> Link Platforms to activate live API feed." : null}
          />
          <StatCard 
            label="YouTube Subscribers" 
            value={artist.isSynced && artist.analytics?.youtube?.subscribers != null ? artist.analytics.youtube.subscribers.toLocaleString() : 'N/A'} 
            icon={FaYoutube} 
            color="bg-red-500"
            trend={artist.isSynced && artist.analytics?.youtube?.avd ? `AVD: ${artist.analytics.youtube.avd}` : null}
            tooltip={!artist.isSynced ? "To link YouTube: Connect your YouTube Channel ID via OAuth in Settings." : null}
          />
          <StatCard 
            label="Instagram Followers" 
            value={artist.isSynced && artist.analytics?.instagram?.followers != null ? artist.analytics.instagram.followers.toLocaleString() : 'N/A'} 
            icon={FaInstagram} 
            color="bg-pink-500"
            trend={artist.isSynced && artist.analytics?.instagram?.followerVelocity ? `${artist.analytics.instagram.followerVelocity}% Velocity` : null}
            tooltip={!artist.isSynced ? "To link Meta: Connect your Instagram Professional account in Settings to activate real-time tracking." : null}
          />
        </div>

        <div className="bg-[var(--color-bg-surface)] rounded-[3rem] border border-[var(--color-bg-border)] overflow-hidden">
          <div className="p-8 border-b border-[var(--color-bg-border)] flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-[var(--color-text-primary)] uppercase tracking-tight italic">Mission Timeline</h3>
              <p className="text-[10px] text-[var(--color-text-muted)] font-black uppercase tracking-widest mt-1">Event History</p>
            </div>
            <button 
              onClick={() => setIsInjectModalOpen(true)}
              className="flex items-center gap-2 bg-blue-500 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:shadow-xl hover:shadow-blue-500/20 transition-all"
            >
              <Zap size={14} strokeWidth={3} /> Add Event
            </button>
          </div>
          <div className="p-8 space-y-6">
            {(!artist.events || artist.events.length === 0) ? (
              <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-widest italic text-center py-6">N/A - No events scheduled</p>
            ) : (
              artist.events.map((ev, i) => (
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
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-[var(--color-bg-surface)] p-8 rounded-[3rem] border border-[var(--color-bg-border)]">
            <h3 className="text-xl font-black text-[var(--color-text-primary)] uppercase tracking-tight italic mb-6">Discography</h3>
            <div className="space-y-4">
              {(!artist.discography || artist.discography.length === 0) ? (
                <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-widest italic py-6 text-center">N/A - No discography available</p>
              ) : (
                artist.discography.map((song, i) => (
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
                    {song.spotify && (
                      <a href={song.spotify} target="_blank" rel="noopener" className="w-8 h-8 rounded-full border border-[var(--color-bg-border)] flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all">
                        <FaSpotify size={14} />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-[var(--color-bg-surface)] p-8 rounded-[3rem] border border-[var(--color-bg-border)]">
            <h3 className="text-xl font-black text-[var(--color-text-primary)] uppercase tracking-tight italic mb-6">Growth Velocity</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                  <span>Follower Velocity (30d)</span>
                  <span className="text-blue-500">{artist.analytics?.instagram?.followerVelocity != null ? `${artist.analytics.instagram.followerVelocity}%` : 'N/A'}</span>
                </div>
                <div className="w-full h-2 bg-[var(--color-bg-workspace)] rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all" style={{ width: `${artist.analytics?.instagram?.followerVelocity || 0}%` }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                  <span>Audience Quality</span>
                  <span className="text-emerald-500">{artist.analytics?.instagram?.audienceQuality != null ? `${artist.analytics.instagram.audienceQuality}%` : 'N/A'}</span>
                </div>
                <div className="w-full h-2 bg-[var(--color-bg-workspace)] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${artist.analytics?.instagram?.audienceQuality || 0}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-[var(--color-bg-surface)] p-8 rounded-[3rem] border border-[var(--color-bg-border)] space-y-6">
          <div>
            <h4 className="text-sm font-black text-[var(--color-text-primary)] uppercase tracking-widest italic">Core Bio</h4>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mt-4">
              {artist.bio || 'No bio provided for this artist.'}
            </p>
            <div className="flex flex-wrap gap-2 pt-6 mt-6 border-t border-[var(--color-bg-border)]">
              {artist.website && (
                <a href={artist.website} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-blue-500 hover:text-white transition-all">
                   <Globe size={12} /> Official Website
                </a>
              )}
              {artist.socials?.spotify && (
                <a href={artist.socials.spotify} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-500 hover:text-white transition-all">
                   <FaSpotify size={12} /> Spotify Artist
                </a>
              )}
              {artist.socials?.youtube && (
                <a href={artist.socials.youtube} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-red-500 hover:text-white transition-all">
                   <FaYoutube size={12} /> YouTube Channel
                </a>
              )}
              {artist.socials?.instagram && (
                <a href={artist.socials.instagram} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-pink-500 hover:text-white transition-all">
                   <FaInstagram size={12} /> Instagram
                </a>
              )}
              {artist.socials?.instagramCollective && (
                <a href={artist.socials.instagramCollective} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-purple-500 hover:text-white transition-all">
                   <FaInstagram size={12} /> Collective IG
                </a>
              )}
            </div>
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
            </div>
          </div>
        </div>
      </div>

      <NexusModal
        isOpen={isInjectModalOpen}
        onClose={() => setIsInjectModalOpen(false)}
        title="Add New Event"
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
              placeholder="Add event details..."
            />
          </div>
          <button 
            type="submit"
            className="w-full py-4 bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:shadow-2xl hover:shadow-blue-500/30 transition-all"
          >
            Add Event
          </button>
        </form>
      </NexusModal>
    </div>
  );
};

export default OverviewTab;
