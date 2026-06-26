/**
 * WebAuthn passkey registration + authentication (alongside password/JWT flows).
 */
const crypto = require('crypto');
const { apiOk, apiError } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../middleware/asyncHandler');
const User = require('../../../models/User');

const challenges = new Map();

function storeChallenge(userId, challenge) {
  const token = crypto.randomBytes(16).toString('hex');
  challenges.set(token, { userId, challenge, expires: Date.now() + 5 * 60 * 1000 });
  return token;
}

function consumeChallenge(token) {
  const entry = challenges.get(token);
  if (!entry || entry.expires < Date.now()) {
    challenges.delete(token);
    return null;
  }
  challenges.delete(token);
  return entry;
}

const registerOptions = asyncHandler(async (req, res) => {
  const user = req.user;
  const challenge = crypto.randomBytes(32).toString('base64url');
  const token = storeChallenge(user._id.toString(), challenge);
  return apiOk(res, {
    challengeToken: token,
    publicKey: {
      challenge,
      rp: { name: 'CoreKnot', id: req.hostname },
      user: {
        id: Buffer.from(user._id.toString()).toString('base64url'),
        name: user.email,
        displayName: user.name,
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required',
      },
      timeout: 60000,
      attestation: 'none',
    },
  });
});

const registerVerify = asyncHandler(async (req, res) => {
  const { challengeToken, credentialId } = req.body || {};
  const entry = consumeChallenge(challengeToken);
  if (!entry || entry.userId !== req.user._id.toString()) {
    return apiError(res, 'Invalid or expired WebAuthn challenge', 400);
  }
  if (!credentialId) {
    return apiError(res, 'credentialId required', 400);
  }

  await User.findByIdAndUpdate(req.user._id, {
    $set: {
      webauthnCredentialId: credentialId,
      webauthnRegisteredAt: new Date(),
    },
  });

  return apiOk(res, { registered: true });
});

const loginOptions = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!email) return apiError(res, 'email required', 400);
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user?.webauthnCredentialId) {
    return apiError(res, 'No passkey registered for this account', 404);
  }

  const challenge = crypto.randomBytes(32).toString('base64url');
  const token = storeChallenge(user._id.toString(), challenge);
  return apiOk(res, {
    challengeToken: token,
    publicKey: {
      challenge,
      timeout: 60000,
      rpId: req.hostname,
      allowCredentials: [
        {
          id: user.webauthnCredentialId,
          type: 'public-key',
        },
      ],
      userVerification: 'required',
    },
  });
});

module.exports = { registerOptions, registerVerify, loginOptions };
