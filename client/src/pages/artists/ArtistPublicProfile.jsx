import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Calendar, Globe, Mail, MapPin, Mic2, FileDown, Music2, ExternalLink } from 'lucide-react';
import { FaSpotify, FaYoutube, FaInstagram, FaFacebook, FaSoundcloud } from 'react-icons/fa';
import { Card, Input, Button, PageSkeleton, QueryErrorBanner, getQueryErrorMessage } from '../../components/ui';
import BrandLogo from '../../components/brand/BrandLogo';

const SOCIAL_ICONS = {
  spotify: FaSpotify,
  youtube: FaYoutube,
  instagram: FaInstagram,
  facebook: FaFacebook,
  soundcloud: FaSoundcloud,
  website: Globe,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function usePublicArtist(slug) {
  return useQuery({
    queryKey: ['artist-public', slug],
    queryFn: async () => (await axios.get(`/api/artists/public/${slug}`)).data,
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  });
}

function formatGigDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function setMetaTag(attr, key, content) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function ArtistPublicProfile() {
  const { slug } = useParams();
  const { data: artist, isLoading, isError, error } = usePublicArtist(slug);
  const [form, setForm] = useState({
    clientName: '',
    email: '',
    phone: '',
    eventName: '',
    eventDate: '',
    expectedBudget: '',
    message: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const bookingMutation = useMutation({
    mutationFn: (payload) => axios.post(`/api/artists/public/${slug}/inquiry`, payload),
    onSuccess: () => setSubmitted(true),
  });

  useEffect(() => {
    if (!artist) return;
    const title = `${artist.name} | Artist Profile`;
    document.title = title;
    setMetaTag('property', 'og:title', title);
    setMetaTag('property', 'og:description', artist.bio || `Book ${artist.name} for your next event.`);
    setMetaTag('property', 'og:type', 'profile');
    if (artist.profileImage) setMetaTag('property', 'og:image', artist.profileImage);
    return () => {
      document.title = 'CoreKnot';
    };
  }, [artist]);

  const validateForm = () => {
    const next = {};
    if (!form.clientName.trim()) next.clientName = 'Your name is required';
    if (!form.email.trim() && !form.phone.trim()) {
      next.contact = 'Email or phone is required';
    }
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
      next.email = 'Enter a valid email address';
    }
    if (form.eventDate) {
      const d = new Date(form.eventDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (Number.isNaN(d.getTime())) next.eventDate = 'Enter a valid date';
      else if (d < today) next.eventDate = 'Event date cannot be in the past';
    }
    if (form.expectedBudget !== '' && Number(form.expectedBudget) < 0) {
      next.expectedBudget = 'Budget cannot be negative';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    await bookingMutation.mutateAsync({
      clientName: form.clientName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      eventName: form.eventName.trim() || undefined,
      eventDate: form.eventDate || undefined,
      expectedBudget: form.expectedBudget ? Number(form.expectedBudget) : undefined,
      metadata: form.message.trim() ? { message: form.message.trim() } : undefined,
    });
  };

  const socialEntries = useMemo(
    () => Object.entries(artist?.socialLinks || {}).filter(([, url]) => url),
    [artist?.socialLinks],
  );

  if (isLoading) return <PageSkeleton rows={6} />;

  if (isError || !artist) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <QueryErrorBanner message={getQueryErrorMessage(error) || 'Artist not found'} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-app)]">
      <header className="border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <BrandLogo size={32} />
          <span className="text-xs font-bold text-slate-500">Artist Profile</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <section className="text-center space-y-4">
          {artist.profileImage && (
            <img
              src={artist.profileImage}
              alt={artist.name}
              className="w-28 h-28 rounded-full object-cover mx-auto border-4 border-emerald-500/20"
            />
          )}
          <div>
            <h1 className="text-3xl font-black">{artist.name}</h1>
            {artist.bio && (
              <p className="text-slate-600 dark:text-slate-400 mt-3 leading-relaxed max-w-xl mx-auto">
                {artist.bio}
              </p>
            )}
          </div>
          {socialEntries.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {socialEntries.map(([key, url]) => {
                const Icon = SOCIAL_ICONS[key] || Globe;
                return (
                  <a
                    key={key}
                    href={url.startsWith('http') ? url : `https://${url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-[var(--color-bg-border)] hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Icon size={14} /> {key}
                  </a>
                );
              })}
            </div>
          )}
          {artist.pressKitUrl && (
            <a
              href={artist.pressKitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600 hover:underline"
            >
              <FileDown size={14} />
              {artist.pressKitTitle || 'Download press kit'}
            </a>
          )}
        </section>

        {(artist.musicLinks || []).length > 0 && (
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
              <Music2 size={14} /> Music
            </h2>
            <div className="grid gap-2">
              {artist.musicLinks.map((link) => {
                const Icon = SOCIAL_ICONS[link.platform] || ExternalLink;
                return (
                  <a
                    key={`${link.platform}-${link.url}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-bg-border)] hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <Icon size={16} />
                    <span className="font-bold text-sm">{link.label}</span>
                    <span className="text-xs text-slate-500 ml-auto capitalize">{link.platform}</span>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {(artist.upcomingGigs || []).length > 0 && (
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
              <Calendar size={14} /> Upcoming Shows
            </h2>
            <div className="space-y-3">
              {artist.upcomingGigs.map((gig, idx) => (
                <Card key={`${gig.venue}-${gig.date}-${idx}`} className="p-4">
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <MapPin size={12} /> {gig.venue || 'TBA'}
                    {gig.date && <span className="ml-2 font-bold text-[var(--color-text-primary)]">· {formatGigDate(gig.date)}</span>}
                  </p>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
            <Mic2 size={14} /> Book {artist.name}
          </h2>
          <Card className="p-5">
            {submitted ? (
              <p className="text-sm text-emerald-600 font-medium">
                Thanks — your inquiry was sent to {artist.name}&apos;s team.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                <Input
                  label="Your name"
                  required
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  error={fieldErrors.clientName}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Email"
                    type="email"
                    icon={Mail}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    error={fieldErrors.email || fieldErrors.contact}
                  />
                  <Input
                    label="Phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    error={!fieldErrors.email ? fieldErrors.contact : undefined}
                  />
                </div>
                <Input
                  label="Event name"
                  value={form.eventName}
                  onChange={(e) => setForm({ ...form, eventName: e.target.value })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Event date"
                    type="date"
                    value={form.eventDate}
                    onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                    error={fieldErrors.eventDate}
                  />
                  <Input
                    label="Budget (INR)"
                    type="number"
                    min="0"
                    value={form.expectedBudget}
                    onChange={(e) => setForm({ ...form, expectedBudget: e.target.value })}
                    error={fieldErrors.expectedBudget}
                  />
                </div>
                <Input
                  label="Message"
                  multiline
                  rows={3}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
                <Button type="submit" disabled={bookingMutation.isPending}>
                  {bookingMutation.isPending ? 'Sending…' : 'Send booking inquiry'}
                </Button>
                {bookingMutation.isError && (
                  <p className="text-xs text-rose-500">{getQueryErrorMessage(bookingMutation.error)}</p>
                )}
              </form>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
}
