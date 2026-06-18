require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

let tokenApiKey = null;
try {
  const raw = String(process.env.UPLOADTHING_TOKEN || '').replace(/^"|"$/g, '');
  const tokenData = JSON.parse(Buffer.from(raw, 'base64').toString());
  tokenApiKey = tokenData.apiKey;
} catch (err) {
  console.error('Failed to parse UPLOADTHING_TOKEN:', err.message);
}

const secret = process.env.UPLOADTHING_SECRET || '';
console.log('token apiKey set:', Boolean(tokenApiKey));
console.log('secret set:', Boolean(secret));
console.log('keys match:', tokenApiKey === secret);
