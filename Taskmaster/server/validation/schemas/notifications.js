const { z } = require('zod');

const pushSubscribeBody = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});

const pushUnsubscribeBody = z.object({
  endpoint: z.string().url(),
});

module.exports = {
  pushSubscribeBody,
  pushUnsubscribeBody,
};
