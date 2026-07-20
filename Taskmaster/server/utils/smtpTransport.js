const INVALID_HOSTS = new Set(['', 'localhost', '127.0.0.1', 'mock_smtp_host']);

const isValidSmtpHost = (host) => {
  if (!host || typeof host !== 'string') return false;
  return !INVALID_HOSTS.has(host.trim().toLowerCase());
};

const autoMailerCampaignUrl = () => {
  const origin = String(process.env.AUTO_MAILER_URL || 'https://auto-mailer-blue.vercel.app').replace(/\/+$/, '');
  return origin.endsWith('/campaigns') ? origin : `${origin}/campaigns`;
};

const movedTransportContract = () => ({
  success: false,
  service: 'auto-mailer',
  url: autoMailerCampaignUrl(),
  message: 'Campaign email transport moved to Auto-Mailer',
});

const buildProfileTransporter = () => null;
const buildEnvTransporter = () => null;
const resolveMailTransport = async () => movedTransportContract();
const sendViaTransport = async () => movedTransportContract();

module.exports = {
  isValidSmtpHost,
  buildProfileTransporter,
  buildEnvTransporter,
  resolveMailTransport,
  sendViaTransport,
};
