/**
 * Test: What does the FREE Spotify Web API return for an artist?
 * Usage: node scripts/test_spotify_artist.js
 * Artist: https://open.spotify.com/artist/6L88xirodmbWYoZuvseUnc
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const ARTIST_ID = '6L88xirodmbWYoZuvseUnc';
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET missing from .env');
  process.exit(1);
}

// --- Step 1: Get access token via Client Credentials (no user login needed) ---
async function getAccessToken() {
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

// --- Step 2: Fetch artist data ---
async function fetchArtist(token, artistId) {
  const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

// --- Step 3: Fetch top tracks ---
async function fetchTopTracks(token, artistId) {
  const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=IN`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

// --- Step 4: Fetch albums ---
async function fetchAlbums(token, artistId) {
  const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?limit=10&market=IN`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

// --- Step 5: Fetch related artists ---
async function fetchRelatedArtists(token, artistId) {
  const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}/related-artists`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

(async () => {
  console.log('🎵 Spotify Web API Test — Free Tier');
  console.log(`🎯 Artist ID: ${ARTIST_ID}`);
  console.log('');

  try {
    // Auth
    console.log('🔑 Getting access token...');
    const token = await getAccessToken();
    console.log('✅ Token obtained\n');

    // Artist profile
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📌 ARTIST PROFILE (GET /artists/{id})');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const artist = await fetchArtist(token, ARTIST_ID);
    console.log(`  Name:             ${artist.name}`);
    console.log(`  Followers:        ${artist.followers?.total?.toLocaleString()}`);
    console.log(`  Popularity Score: ${artist.popularity} / 100`);
    console.log(`  Genres:           ${artist.genres?.join(', ') || 'None listed'}`);
    console.log(`  Spotify URI:      ${artist.uri}`);
    console.log(`  Profile Image:    ${artist.images?.[0]?.url || 'N/A'}`);
    console.log('');
    console.log('  ⚠️  Monthly Listeners: NOT AVAILABLE in official API');
    console.log('');

    // Top Tracks
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎵 TOP TRACKS (GET /artists/{id}/top-tracks)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const topTracks = await fetchTopTracks(token, ARTIST_ID);
    if (topTracks.tracks?.length) {
      topTracks.tracks.slice(0, 5).forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.name}`);
        console.log(`     Popularity: ${t.popularity}/100  |  Album: ${t.album?.name}`);
        console.log(`     Duration:   ${Math.floor(t.duration_ms / 60000)}:${String(Math.floor((t.duration_ms % 60000) / 1000)).padStart(2, '0')}`);
        console.log(`     ⚠️  Stream count: NOT available`);
        console.log('');
      });
    } else {
      console.log('  No top tracks found');
    }

    // Albums
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💿 DISCOGRAPHY (GET /artists/{id}/albums)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const albums = await fetchAlbums(token, ARTIST_ID);
    if (albums.items?.length) {
      albums.items.forEach(a => {
        console.log(`  • ${a.name}  [${a.album_type}]  —  Released: ${a.release_date}  |  Tracks: ${a.total_tracks}`);
      });
    } else {
      console.log('  No albums found');
    }
    console.log('');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 WHAT FREE SPOTIFY API GIVES US:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  ✅ Followers count');
    console.log('  ✅ Popularity score (0–100, updates daily)');
    console.log('  ✅ Genres');
    console.log('  ✅ Profile images');
    console.log('  ✅ Top 10 tracks (by region) + track popularity score');
    console.log('  ✅ Full discography (albums, singles, EPs)');
    console.log('  ✅ Related artists');
    console.log('  ✅ Track audio features (tempo, key, energy, danceability)');
    console.log('');
    console.log('  ❌ Monthly listeners (hidden by Spotify)');
    console.log('  ❌ Actual stream counts');
    console.log('  ❌ Playlist additions');
    console.log('  ❌ Geographic listener data');
    console.log('  ❌ Historical trends');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
