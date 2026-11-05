import { Resend } from 'resend';
import { HttpError } from './errors.js';

const testInbox = [];
let failNextDelivery = false;

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

function deliveryError() {
  return new HttpError(503, 'DELIVERY_UNAVAILABLE', 'We could not send a verification code. Please try again.');
}

function deliveryDetail(error) {
  const status = error?.statusCode || error?.name || 'send_failed';
  const message = String(error?.message || '')
    .replace(/re_[A-Za-z0-9_]+/g, '[redacted]')
    .replace(/\b\d{6}\b/g, '[redacted]');
  return `${status}${message ? `: ${message}` : ''}`;
}

function credentialsReady() {
  return Boolean(String(process.env.RESEND_API_KEY || '').trim() && String(process.env.EMAIL_FROM || '').trim());
}

function senderAddress() {
  const from = String(process.env.EMAIL_FROM || '').trim();
  if (from.includes('<') && from.endsWith('>')) return from;
  return `Eventra <${from}>`;
}

function verificationLetter({ kind, guestName, eventName, code }) {
  const registration = kind !== 'tickets';
  const hello = registration ? `Hello ${guestName},` : 'Hello,';
  const intro = registration
    ? `You are one step away from confirming your registration for ${eventName}.`
    : 'Use this code to view the Eventra tickets registered to this email address.';
  const ignore = registration
    ? 'If you did not initiate this registration, you can safely ignore this email.'
    : 'If you did not request access to these tickets, you can safely ignore this email.';
  const security = 'Eventra will never ask you to share this code.';
  const safeHello = registration ? `Hello ${escapeHtml(guestName)},` : 'Hello,';
  const safeIntro = registration
    ? `You are one step away from confirming your registration for <strong>${escapeHtml(eventName)}</strong>.`
    : 'Use this code to view the Eventra tickets registered to this email address.';
  const otp = escapeHtml(code);
  const text = [
    hello,
    '',
    intro,
    '',
    'Your Eventra verification code is:',
    '',
    code,
    '',
    'This code expires in 5 minutes.',
    '',
    ignore,
    security,
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
                <p style="margin:0 0 16px;">${safeHello}</p>
                <p style="margin:0 0 16px;">${safeIntro}</p>
                <p style="margin:0 0 8px;color:#55637a;">Your Eventra verification code is:</p>
                <p style="margin:0 0 16px;font-size:32px;font-weight:800;letter-spacing:0.18em;color:#2d4fe0;">${otp}</p>
                <p style="margin:0 0 16px;">This code expires in 5 minutes.</p>
                <p style="margin:0 0 8px;color:#55637a;">${escapeHtml(ignore)}</p>
                <p style="margin:0 0 16px;color:#55637a;">${escapeHtml(security)}</p>
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

export async function sendVerificationEmail({ to, guestName, eventName, code, kind = 'registration' }) {
  const letter = verificationLetter({ kind, guestName, eventName, code });
  const subject = kind === 'tickets' ? 'Your Eventra Ticket Access Code' : 'Your Eventra Verification Code';

  // Automated tests read this inbox. The application process never uses it.
  if (process.env.NODE_ENV === 'test') {
    if (failNextDelivery) {
      failNextDelivery = false;
      throw deliveryError();
    }
    testInbox.push({ to, subject, kind, code, text: letter.text });
    return { accepted: true };
  }

  if (!credentialsReady()) {
    console.error('Resend is not configured. Set RESEND_API_KEY and EMAIL_FROM.');
    throw deliveryError();
  }

  try {
    const resend = new Resend(String(process.env.RESEND_API_KEY).trim());
    const { data, error } = await resend.emails.send({
      from: senderAddress(),
      to,
      subject,
      text: letter.text,
      html: letter.html,
    });
    if (error || !data?.id) {
      console.error('Verification email was not accepted by Resend.', deliveryDetail(error));
      throw deliveryError();
    }
    console.info(`Verification email accepted by Resend. ${data.id}`);
    return { accepted: true, id: data.id };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('Verification email was not accepted by Resend.', deliveryDetail(error));
    throw deliveryError();
  }
}
