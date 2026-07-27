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
    this.portalUrl =
      this.config.get<string>('COURSES_URL') ?? 'https://courses.tutorconnect.ng';
    this.supportEmail =
      this.config.get<string>('SUPPORT_EMAIL') ?? 'support@tutorconnect.ng';
    this.supportWhatsapp = this.config.get<string>('SUPPORT_WHATSAPP') ?? '';
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY not set — access-code emails will be logged only');
    }
  }

  async sendAccessCode(input: AccessCodeEmail): Promise<MailResult> {
    if (!this.resend) {
      this.logger.log(
        `[mail skipped] code for ${input.to} (${input.guideTitle}): ${input.code}`,
      );
      return { status: 'SKIPPED', error: 'RESEND_API_KEY not configured' };
    }
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: input.to,
        subject: `Your access code for ${input.courseCode} — ${input.guideTitle}`,
        html: this.template(input),
      });
      if (error) {
        return { status: 'FAILED', error: error.message ?? String(error) };
      }
      return { status: 'SENT' };
    } catch (e) {
      return { status: 'FAILED', error: e instanceof Error ? e.message : String(e) };
    }
  }

  private template(i: AccessCodeEmail): string {
    const support = this.supportWhatsapp
      ? `<a href="https://wa.me/${this.supportWhatsapp.replace(/\D/g, '')}" style="color:#f47b20;text-decoration:none">WhatsApp support</a> or email <a href="mailto:${this.supportEmail}" style="color:#f47b20;text-decoration:none">${this.supportEmail}</a>`
      : `<a href="mailto:${this.supportEmail}" style="color:#f47b20;text-decoration:none">${this.supportEmail}</a>`;

    return `
<div style="margin:0;padding:28px 16px;background:#eef1f6;font-family:'Segoe UI',system-ui,-apple-system,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(26,58,92,.12)">
    <div style="background:linear-gradient(135deg,#142e4a,#1a3a5c 55%,#1f4a75);padding:26px 26px 22px">
      <div style="font-size:21px;font-weight:800;letter-spacing:-.4px;color:#fff">
        Tutor<span style="color:#f47b20">Connect</span>
      </div>
      <div style="margin-top:14px;font-size:22px;font-weight:800;color:#fff;line-height:1.25">
        Your guide is ready, ${escapeHtml(i.buyerName)} 🎓
      </div>
    </div>

    <div style="padding:26px">
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#5b6b7d">
        Thanks for your purchase. Use the one-time access code below to unlock
        <strong style="color:#1a3a5c">${escapeHtml(i.courseCode)} — ${escapeHtml(i.guideTitle)}</strong>.
      </p>

      <div style="background:#fdebdd;border:1.5px dashed #f47b20;border-radius:14px;padding:18px;text-align:center;margin-bottom:18px">
        <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#c2610f">Your access code</div>
        <div style="font-size:27px;font-weight:800;letter-spacing:2px;color:#1a3a5c;margin-top:8px;font-family:ui-monospace,Menlo,Consolas,monospace">${escapeHtml(i.code)}</div>
      </div>

      <a href="${this.portalUrl}" style="display:block;background:#f47b20;color:#fff;text-decoration:none;text-align:center;border-radius:12px;padding:15px;font-size:15px;font-weight:700">
        Open my guide →
      </a>

      <div style="margin-top:24px;padding-top:18px;border-top:1px solid #e5eaf0">
        <div style="font-size:13px;font-weight:700;color:#1a3a5c;margin-bottom:8px">How it works</div>
        <ol style="margin:0;padding-left:18px;font-size:13.5px;line-height:1.7;color:#5b6b7d">
          <li>Open <span style="color:#1a3a5c;font-weight:600">${this.portalUrl.replace(/^https?:\/\//, '')}</span> on the device you'll read on.</li>
          <li>Enter your access code.</li>
          <li>The guide unlocks and stays unlocked on that browser.</li>
        </ol>
      </div>

      <p style="margin:18px 0 0;font-size:12.5px;line-height:1.6;color:#8497aa">
        This code works once and locks to the first browser that uses it, so please
        redeem it on the device you read on. Changed phone or cleared your browser?
        Contact ${support} and we'll restore your access.
      </p>
    </div>

    <div style="background:#f7f9fc;padding:16px;text-align:center;font-size:11.5px;color:#8497aa">
      Tutor Connect · Learn Better. Achieve More.
    </div>
  </div>
</div>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
