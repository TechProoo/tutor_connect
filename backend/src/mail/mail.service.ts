import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface AccessCodeEmail {
  to: string;
  buyerName: string;
  guideTitle: string;
  courseCode: string;
  code: string;
}

export type MailResult =
  | { status: 'SENT' }
  | { status: 'SKIPPED'; error: string }
  | { status: 'FAILED'; error: string };

const DEFAULT_PORTAL_URL = 'https://courses.tutorconnect.ng';

/**
 * Transactional email via Resend. When RESEND_API_KEY is absent the service
 * degrades to logging, so local development never blocks on email delivery.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly portalUrl: string;
  private readonly supportEmail: string;
  private readonly supportWhatsapp: string;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('RESEND_API_KEY');
    this.resend = key ? new Resend(key) : null;
    this.from =
      this.config.get<string>('MAIL_FROM') ??
      'Tutor Connect <noreply@tutorconnect.ng>';
    this.portalUrl = safeHttpsUrl(
      this.config.get<string>('COURSES_URL') ?? DEFAULT_PORTAL_URL,
    );
    this.supportEmail = stripLineBreaks(
      this.config.get<string>('SUPPORT_EMAIL') ?? 'Tutorconnectng@gmail.com',
    );
    this.supportWhatsapp = this.config.get<string>('SUPPORT_WHATSAPP') ?? '';
    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY not set. Access-code emails will be skipped.',
      );
    }
  }

  async sendAccessCode(input: AccessCodeEmail): Promise<MailResult> {
    if (!this.resend) {
      // Access codes are credentials, so never write the plaintext value to logs.
      this.logger.log(
        `[mail skipped] access-code email for ${input.to} (${input.courseCode})`,
      );
      return { status: 'SKIPPED', error: 'RESEND_API_KEY not configured' };
    }
    try {
      const courseCode = sanitizeHeader(input.courseCode);
      const guideTitle = sanitizeHeader(input.guideTitle);
      const { error } = await this.resend.emails.send({
        from: this.from,
        // `from` has to sit on a domain verified with the mail provider, which
        // a Gmail address cannot be. Routing replies here means a student who
        // just hits reply still reaches a real inbox.
        replyTo: this.supportEmail,
        to: input.to,
        subject: `Your access code for ${courseCode} | ${guideTitle}`,
        html: this.template(input),
        text: this.textTemplate(input),
      });
      if (error) {
        return { status: 'FAILED', error: error.message ?? String(error) };
      }
      return { status: 'SENT' };
    } catch (e) {
      return {
        status: 'FAILED',
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  private template(i: AccessCodeEmail): string {
    const buyerName = escapeHtml(i.buyerName);
    const guideTitle = escapeHtml(i.guideTitle);
    const courseCode = escapeHtml(i.courseCode);
    const accessCode = escapeHtml(i.code);
    const portalUrl = escapeHtml(this.portalUrl);
    const portalLabel = escapeHtml(
      this.portalUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    );
    const logoUrl = escapeHtml(`${this.portalUrl}/tc-icon.png`);
    const supportEmail = escapeHtml(this.supportEmail);
    const supportMailto = `mailto:${encodeURIComponent(this.supportEmail)}`;
    const whatsappDigits = this.supportWhatsapp.replace(/\D/g, '');
    const whatsappSupport = whatsappDigits
      ? `<a href="https://wa.me/${whatsappDigits}" style="color:#1a3a5c;font-weight:700;text-decoration:underline;text-decoration-color:#f47b20;text-underline-offset:3px">Chat on WhatsApp</a><span style="color:#a4afbb">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`
      : '';

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>Your Tutor Connect access code</title>
  <style>
    @media only screen and (max-width: 620px) {
      .email-wrap { padding: 12px !important; }
      .email-shell { width: 100% !important; }
      .email-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .hero-pad { padding: 28px 22px !important; }
      .access-code { font-size: 24px !important; letter-spacing: 1px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f5f8;color:#1a3a5c;font-family:'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">
    Your one-time Tutor Connect guide access code is inside.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f5f8;border-collapse:collapse">
    <tr>
      <td class="email-wrap" align="center" style="padding:32px 16px">
        <table role="presentation" class="email-shell" width="580" cellspacing="0" cellpadding="0" border="0" style="width:580px;max-width:580px;background:#ffffff;border:1px solid #e5eaf0;border-collapse:separate;border-spacing:0;border-radius:20px;overflow:hidden;box-shadow:0 18px 48px rgba(22,32,43,.10)">
          <tr>
            <td style="height:4px;background:#f47b20;font-size:0;line-height:0">&nbsp;</td>
          </tr>

          <tr>
            <td class="email-pad" style="padding:22px 30px 18px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse">
                <tr>
                  <td width="46" valign="middle" style="width:46px">
                    <img src="${logoUrl}" width="38" height="38" alt="Tutor Connect" style="display:block;width:38px;height:38px;border:0;outline:none;text-decoration:none">
                  </td>
                  <td valign="middle">
                    <div style="font-size:19px;font-weight:800;letter-spacing:-.4px;line-height:1.15;color:#1a3a5c">Tutor <span style="color:#f47b20">Connect</span></div>
                    <div style="margin-top:3px;font-size:9px;font-weight:800;letter-spacing:1.25px;line-height:1.2;color:#8a95a3;text-transform:uppercase">Revision guides</div>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display:inline-block;padding:7px 10px;background:#f4f8f6;border:1px solid #dcece3;border-radius:999px;font-size:10px;font-weight:700;color:#2f7d59">Secure access</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="email-pad" style="padding:0 30px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#1a3a5c;border-collapse:separate;border-radius:16px">
                <tr>
                  <td class="hero-pad" style="padding:32px 30px">
                    <div style="font-size:10px;font-weight:800;letter-spacing:1.4px;line-height:1.2;color:#ff9a4c;text-transform:uppercase">Access ready</div>
                    <h1 style="margin:8px 0 10px;font-size:28px;font-weight:800;letter-spacing:-.7px;line-height:1.18;color:#ffffff">Your guide is ready.</h1>
                    <p style="margin:0;font-size:14px;line-height:1.65;color:#dce6ef">Hi ${buyerName}, your purchase has been confirmed. Everything you need to start reading is below.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="email-pad" style="padding:26px 30px 30px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f8fafc;border:1px solid #e5eaf0;border-collapse:separate;border-radius:12px">
                <tr>
                  <td style="padding:14px 16px">
                    <div style="font-size:9px;font-weight:800;letter-spacing:1.1px;line-height:1.2;color:#8a95a3;text-transform:uppercase">Your guide</div>
                    <div style="margin-top:5px;font-size:14px;font-weight:800;line-height:1.4;color:#1a3a5c"><span style="color:#f47b20">${courseCode}</span>&nbsp;&nbsp;${guideTitle}</div>
                  </td>
                </tr>
              </table>

              <p style="margin:22px 0 12px;font-size:13px;font-weight:700;line-height:1.4;color:#1a3a5c;text-align:center">Your one-time access code</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#fff4ea;border:1px solid #f8c79f;border-collapse:separate;border-radius:14px">
                <tr>
                  <td align="center" style="padding:19px 14px">
                    <div class="access-code" style="font-family:Consolas,'Courier New',monospace;font-size:28px;font-weight:800;letter-spacing:2px;line-height:1.25;color:#1a3a5c;overflow-wrap:anywhere;word-break:break-word">${accessCode}</div>
                  </td>
                </tr>
              </table>
              <p style="margin:10px 0 22px;font-size:11px;line-height:1.55;color:#6b7684;text-align:center">Redeem this code on the browser and device you plan to use for reading.</p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;border-collapse:separate">
                <tr>
                  <td align="center" bgcolor="#1a3a5c" style="background:#1a3a5c;border-radius:12px">
                    <a href="${portalUrl}" style="display:inline-block;padding:15px 27px;border:1px solid #1a3a5c;border-radius:12px;color:#ffffff;font-size:14px;font-weight:800;line-height:1;text-decoration:none">Open my guide&nbsp;&nbsp;<span style="color:#ff9a4c">&#8599;</span></a>
                  </td>
                </tr>
              </table>
              <p style="margin:11px 0 0;font-size:10.5px;line-height:1.5;color:#8a95a3;text-align:center">Or visit <a href="${portalUrl}" style="color:#1a3a5c;font-weight:700;text-decoration:none">${portalLabel}</a></p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:26px;border-collapse:collapse">
                <tr>
                  <td colspan="2" style="padding-bottom:11px;font-size:12px;font-weight:800;color:#1a3a5c">How it works</td>
                </tr>
                <tr>
                  <td width="32" valign="top" style="width:32px;padding:0 0 12px"><span style="display:inline-block;width:23px;height:23px;background:#fff0e5;border-radius:50%;color:#d86612;font-size:11px;font-weight:800;line-height:23px;text-align:center">1</span></td>
                  <td valign="top" style="padding:2px 0 12px;font-size:12.5px;line-height:1.55;color:#5b6876">Open the secure Tutor Connect course portal.</td>
                </tr>
                <tr>
                  <td width="32" valign="top" style="width:32px;padding:0 0 12px"><span style="display:inline-block;width:23px;height:23px;background:#fff0e5;border-radius:50%;color:#d86612;font-size:11px;font-weight:800;line-height:23px;text-align:center">2</span></td>
                  <td valign="top" style="padding:2px 0 12px;font-size:12.5px;line-height:1.55;color:#5b6876">Enter the access code exactly as shown above.</td>
                </tr>
                <tr>
                  <td width="32" valign="top" style="width:32px"><span style="display:inline-block;width:23px;height:23px;background:#fff0e5;border-radius:50%;color:#d86612;font-size:11px;font-weight:800;line-height:23px;text-align:center">3</span></td>
                  <td valign="top" style="padding:2px 0 0;font-size:12.5px;line-height:1.55;color:#5b6876">Your guide unlocks and stays linked to that browser.</td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin-top:24px;background:#f7f9fc;border:1px solid #e5eaf0;border-collapse:separate;border-radius:12px">
                <tr>
                  <td style="padding:16px">
                    <div style="font-size:12px;font-weight:800;line-height:1.4;color:#1a3a5c">Changed your phone or reset your browser?</div>
                    <p style="margin:5px 0 10px;font-size:11.5px;line-height:1.6;color:#6b7684">Contact us and we will help verify your purchase and restore access.</p>
                    <div style="font-size:11.5px;line-height:1.5">${whatsappSupport}<a href="${supportMailto}" style="color:#1a3a5c;font-weight:700;text-decoration:underline;text-decoration-color:#f47b20;text-underline-offset:3px">${supportEmail}</a></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="email-pad" align="center" style="padding:18px 30px;background:#f8fafc;border-top:1px solid #e5eaf0;font-size:10.5px;line-height:1.6;color:#7d8996">
              Purchased through Tutor Connect<br>
              <span style="color:#a3adb8">Learn better. Achieve more.</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private textTemplate(i: AccessCodeEmail): string {
    const supportLines = [
      this.supportWhatsapp
        ? `WhatsApp: https://wa.me/${this.supportWhatsapp.replace(/\D/g, '')}`
        : '',
      `Email: ${this.supportEmail}`,
    ]
      .filter(Boolean)
      .join('\n');

    return `TUTOR CONNECT

Your guide is ready, ${plainText(i.buyerName)}.

Guide: ${plainText(i.courseCode)} | ${plainText(i.guideTitle)}
Your one-time access code: ${plainText(i.code)}

Open your guide:
${this.portalUrl}

HOW IT WORKS
1. Open the secure Tutor Connect course portal.
2. Enter the access code exactly as shown above.
3. Your guide unlocks and stays linked to that browser.

Redeem this code on the browser and device you plan to use for reading. If you change your phone or reset your browser, contact us so we can verify your purchase and restore access.

${supportLines}

Purchased through Tutor Connect
Learn better. Achieve more.`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}

function stripLineBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, '').trim();
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function plainText(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function safeHttpsUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return DEFAULT_PORTAL_URL;
    return url.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_PORTAL_URL;
  }
}
