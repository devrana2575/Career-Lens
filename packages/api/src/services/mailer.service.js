import { createRequire } from 'node:module';
import env from '../config/env.js';

const require = createRequire(import.meta.url);

/** Dev/inspection tape: every last email attempt (subject, to, text). Tests read this. */
export const mailTape = [];

export function clearMailTape() {
  mailTape.length = 0;
}

let cachedTransporter = null;

export function emailEnabled() {
  return Boolean(env.smtpHost && env.smtpPort);
}

function transporter() {
  if (!emailEnabled()) return null;
  if (cachedTransporter) return cachedTransporter;
  try {
    const nodemailer = require('nodemailer');
    cachedTransporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: Number(env.smtpPort),
      secure: Boolean(env.smtpSecure),
      auth: env.smtpUser
        ? { user: env.smtpUser, pass: env.smtpPassword }
        : undefined,
    });
    return cachedTransporter;
  } catch {
    return null;
  }
}

/**
 * Sends an email when SMTP is configured, posts to a webhook gateway when
 * MAILHOOK_URL is set, and otherwise logs to the server console. Never throws —
 * callers must treat email as best-effort.
 */
export async function sendMailLite({ to, subject, text, html }) {
  const attempt = { to, subject, text, html };
  mailTape.push(attempt);
  if (mailTape.length > 50) mailTape.shift();

  if (emailEnabled() && transporter()) {
    await transporter().sendMail({ from: env.smtpFrom, to, subject, text, html });
    return { delivered: true, channel: 'smtp' };
  }
  if (env.mailhookUrl) {
    await fetch(env.mailhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text, html }),
    });
    return { delivered: true, channel: 'hook' };
  }
  console.info(`[mailer] not configured — would send "${subject}" to ${to}`);
  return { delivered: false, reason: 'not-configured' };
}