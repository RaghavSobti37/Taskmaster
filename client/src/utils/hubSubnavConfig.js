import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Mail, FileCode, Zap, BarChart2, Newspaper, Link2, KeyRound, Globe,
  UserPlus, Users, Phone, CalendarCheck, Building2, Monitor, Contact, CreditCard,
  CircleDollarSign, Wallet, Megaphone, Music2, FolderArchive,
} from 'lucide-react';

/** Hub shell — module title + icon for merged toolbar (option D). */
export const HUB_NAV_META = {
  '/crm': { label: 'CRM', icon: UserPlus },
  '/office': { label: 'Office', icon: Building2 },
  '/management': { label: 'Management', icon: CircleDollarSign },
  '/emails': { label: 'Emails', icon: Mail },
  '/assets': { label: 'Assets', icon: FolderArchive },
};

/** Tab icons for query-param hubs (CRM, Office, Management). */
export const HUB_TAB_ICONS = {
  leads: Users,
  followups: Phone,
  bookings: CalendarCheck,
  equipment: Monitor,
  contacts: Contact,
  subscriptions: CreditCard,
  finance: Wallet,
  announcements: Megaphone,
  artists: Music2,
};

/** Route-based subnav for /emails/* */
export const EMAIL_SUBNAV_ITEMS = [
  { id: 'overview', to: '/emails', label: 'Overview', icon: LayoutDashboard, end: true },
  { id: 'campaigns', to: '/emails/campaigns', label: 'Campaigns', icon: Mail },
  { id: 'templates', to: '/emails/templates', label: 'Templates', icon: FileCode },
  { id: 'profiles', to: '/emails/profiles', label: 'Profiles', icon: Zap },
  { id: 'streams', to: '/emails/streams', label: 'Streams', icon: Globe },
  { id: 'analytics', to: '/emails/analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'newsletter', to: '/emails/newsletter', label: 'Newsletter', icon: Newspaper },
];

/** Route-based subnav for /assets/* */
export const ASSETS_SUBNAV_ITEMS = [
  { id: 'links', to: '/assets', label: 'File Links', icon: Link2, end: true },
  { id: 'accounts', to: '/assets/accounts', label: 'Managed Accounts', icon: KeyRound, end: true },
];

export function withHubTabIcons(tabs) {
  return tabs.map((tab) => ({
    ...tab,
    icon: tab.icon || HUB_TAB_ICONS[tab.id],
  }));
}
