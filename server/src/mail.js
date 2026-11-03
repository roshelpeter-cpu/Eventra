import nodemailer from 'nodemailer';
import { HttpError } from './errors.js';

const testInbox = [];
let failNextDelivery = false;

function smtpSettings() {
  return {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASSWORD || '',
    fromEmail: process.env.SMTP_FROM_EMAIL || '',
    fromName: process.env.SMTP_FROM_NAME || 'Eventra',
  };
}

export function smtpConfigured() {
  const settings = smtpSettings();
  return Boolean(settings.host && settings.user && settings.pass && settings.fromEmail);
}

export function lastTestEmail() {
  return testInbox.at(-1) || null;
}

export function clearTestInbox() {
  testInbox.length = 0;
}

export function failNextEmail() {
  failNextDelivery = true;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function verificationLetter({ guestName, eventName, code }) {
  const name = escapeHtml(guestName);
  const event = escapeHtml(eventName);
  const otp = escapeHtml(code);
  const text = [
    `Hello ${guestName},`,
    '',
    `You are one step away from confirming your registration for ${eventName}.`,
    '',
    'Your Eventra verification code is:',
    '',
    code,
    '',
    'This code expires in 5 minutes.',
    '',
    'If you did not initiate this registration, you can safely ignore this email.',
    '',
    'Thank you,',
    'Eventra Team',
  ].join('\n');
  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;background:#f4f6fb;color:#141a2b;font-family:'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e8f2;border-radius:20px;">
            <tr>
              <td style="padding:28px 28px 8px;">
                <p style="margin:0;font-size:20px;font-weight:800;letter-spacing:-0.04em;color:#141a2b;">Eventra</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 28px;line-height:1.55;">
                <p style="margin:0 0 16px;">Hello ${name},</p>
                <p style="margin:0 0 16px;">You are one step away from confirming your registration for <strong>${event}</strong>.</p>
                <p style="margin:0 0 8px;color:#55637a;">Your Eventra verification code is:</p>
                <p style="margin:0 0 16px;font-size:32px;font-weight:800;letter-spacing:0.18em;color:#2d4fe0;">${otp}</p>
                <p style="margin:0 0 16px;">This code expires in 5 minutes.</p>
                <p style="margin:0 0 16px;color:#55637a;">If you did not initiate this registration, you can safely ignore this email.</p>
                <p style="margin:0;">Thank you,<br>Eventra Team</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return { text, html };
}

function deliveryError() {
  return new HttpError(503, 'DELIVERY_UNAVAILABLE', 'We could not send a verification code. Please try again.');
}

export async function sendVerificationEmail({ to, guestName, eventName, code }) {
  if (process.env.NODE_ENV === 'test') {
    if (failNextDelivery) {
      failNextDelivery = false;
      throw deliveryError();
    }
    testInbox.push({
      to,
      guestName,
      eventName,
      code,
      subject: 'Your Eventra Verification Code',
    });
    return { accepted: true };
  }

  if (!smtpConfigured()) {
    console.error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL, and SMTP_FROM_NAME.');
    throw deliveryError();
  }

  const settings = smtpSettings();
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: {
      user: settings.user,
      pass: settings.pass,
    },
  });
  const letter = verificationLetter({ guestName, eventName, code });
  try {
    const info = await transporter.sendMail({
      from: `"${settings.fromName.replace(/"/g, '')}" <${settings.fromEmail}>`,
      to,
      subject: 'Your Eventra Verification Code',
      text: letter.text,
      html: letter.html,
    });
    if (info.rejected?.length) {
      console.error('Verification email was rejected by the mail server.');
      throw deliveryError();
    }
    return { accepted: true };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('Verification email could not be sent.', error?.code || 'send_failed');
    throw deliveryError();
  }
}
