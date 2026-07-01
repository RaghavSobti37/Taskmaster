const { z } = require('zod');

const registerBody = z.object({
  name: z.string().min(1),
  email: z.string().min(1),
  password: z.string().min(1),
  gender: z.enum(['male', 'female', 'other']).optional(),
  departmentId: z.string().nullable().optional(),
});

const loginBody = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

const forgotPasswordBody = z.object({
  email: z.string().min(1),
});

const resetPasswordBody = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(1),
  confirmPassword: z.string().min(1),
});

const changeRequiredPasswordBody = z.object({
  newPassword: z.string().min(1),
  confirmPassword: z.string().min(1),
});

const oauthEstablishBody = z.object({
  ticket: z.string().min(1),
});

const clerkEstablishBody = z.object({
  token: z.string().min(1),
  organizationId: z.string().optional(),
});

module.exports = {
  registerBody,
  loginBody,
  forgotPasswordBody,
  resetPasswordBody,
  changeRequiredPasswordBody,
  oauthEstablishBody,
  clerkEstablishBody,
};
