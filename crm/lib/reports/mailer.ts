import type { SendResult } from "./types";

export type MailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function getSmtpConfig():
  | {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
      from: string;
      bcc?: string;
    }
  | null {
  const host = process.env.CRM_SMTP_HOST?.trim();
  const user = process.env.CRM_SMTP_USER?.trim();
  const pass = process.env.CRM_SMTP_PASS?.trim();
  const from = process.env.CRM_DIGEST_FROM?.trim() || user;
  const bcc = process.env.CRM_SMTP_BCC?.trim();
  if (!host || !user || !pass || !from) return null;
  const port = parseInt(process.env.CRM_SMTP_PORT || "587", 10);
  /** Gmail: 465 = SSL; 587 = STARTTLS (secure should be false). */
  const secure =
    process.env.CRM_SMTP_SECURE === "1" ||
    process.env.CRM_SMTP_SECURE === "true" ||
    port === 465;
  return { host, port, secure, user, pass, from, bcc: bcc || undefined };
}

export function isMailConfigured(): boolean {
  return getSmtpConfig() !== null;
}

export async function sendReportEmail(payload: MailPayload): Promise<SendResult> {
  const cfg = getSmtpConfig();
  if (!cfg) {
    return { ok: false, error: "SMTP not configured (CRM_SMTP_* / CRM_DIGEST_FROM)" };
  }
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
      requireTLS: cfg.port === 587 && !cfg.secure,
    });
    const fromHeader =
      process.env.CRM_DIGEST_FROM_NAME?.trim()
        ? `${process.env.CRM_DIGEST_FROM_NAME.trim()} <${cfg.from}>`
        : cfg.from;
    const info = await transporter.sendMail({
      from: fromHeader,
      to: payload.to,
      bcc: cfg.bcc,
      subject: payload.subject,
      text: payload.text ?? stripHtml(payload.html),
      html: payload.html,
    });
    console.info("[mailer] accepted by SMTP", {
      to: payload.to,
      bcc: cfg.bcc ? "(set)" : undefined,
      messageId: info.messageId,
    });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
