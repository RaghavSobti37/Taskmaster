const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xyzcompany.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_supabase_key';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

/**
 * Helper to broadcast realtime events via Supabase channels
 */
const broadcastRealtimeEvent = async (channelName, event, payload) => {
  try {
    if (supabaseUrl && supabaseUrl !== 'https://xyzcompany.supabase.co') {
      const channel = supabase.channel(channelName);
      await channel.send({
        type: 'broadcast',
        event: event,
        payload: payload,
      });
      console.log(`[SUPABASE REALTIME] Broadcasted event ${event} on channel ${channelName}`);
    }
  } catch (err) {
    console.warn('[SUPABASE REALTIME WARNING] Broadcast failed:', err.message);
  }
};

module.exports = {
  supabase,
  broadcastRealtimeEvent
};
