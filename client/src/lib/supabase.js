import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xyzcompany.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_supabase_key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Subscribe to realtime broadcast events on a channel
 */
export const subscribeToChannel = (channelName, event, callback) => {
  const channel = supabase.channel(channelName)
    .on('broadcast', { event }, (message) => {
      callback(message.payload);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
