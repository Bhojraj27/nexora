import "server-only";
import { config } from "@/lib/config";
import { logger } from "@/lib/logger";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  readonly name: string;
  send(payload: EmailPayload): Promise<void>;
}

class MockEmailProvider implements EmailProvider {
  readonly name = "mock";
  async send(payload: EmailPayload) {
    logger.info("email [mock]", {
      to: payload.to,
      subject: payload.subject,
      textPreview: payload.text.slice(0, 160),
    });
  }
}

class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  async send(payload: EmailPayload) {
    throw new Error(`SMTP provider not configured in this build (tried to send to ${payload.to})`);
  }
}

const globalForEmail = globalThis as unknown as { emailProvider?: EmailProvider };

export function getEmailProvider(): EmailProvider {
  if (globalForEmail.emailProvider) return globalForEmail.emailProvider;
  const provider =
    config.emailProvider === "smtp" && config.smtpUrl
      ? new SmtpEmailProvider()
      : new MockEmailProvider();
  globalForEmail.emailProvider = provider;
  return provider;
}

export function buildVerifyEmailLink(token: string): string {
  return `${config.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
}

export function buildResetPasswordLink(token: string): string {
  return `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

export function buildInviteLink(token: string): string {
  return `${config.appUrl}/invite?token=${encodeURIComponent(token)}`;
}
