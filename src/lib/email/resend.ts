import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || "BuildMate <onboarding@resend.dev>";
const appUrl = process.env.APP_URL || "http://localhost:3000";

const resend = resendApiKey && !resendApiKey.includes("placeholder")
  ? new Resend(resendApiKey)
  : null;

/**
 * Sends an email verification link to the newly registered user.
 * 
 * Security rules:
 * 1. RESEND_API_KEY is server-only and never exposed to the client.
 * 2. Raw tokens are never logged.
 * 3. Throws or returns failure so caller can handle failure resilience.
 */
export async function sendVerificationEmail(
  toEmail: string,
  rawToken: string
): Promise<{ success: boolean; error?: string }> {
  const verificationUrl = `${appUrl}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;

  if (!resend) {
    if (process.env.NODE_ENV === "development") {
      console.info("\n=======================================================");
      console.info(`[Auth/Email] LOCAL DEV VERIFICATION LINK FOR ${toEmail}:`);
      console.info(verificationUrl);
      console.info("=======================================================\n");
    } else {
      console.info(`[Auth/Email] Verification link generated for ${toEmail} (Email delivery skipped: Resend API key placeholder)`);
    }
    return { success: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: emailFrom,
      to: toEmail,
      subject: "Verify your email — BuildMate",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6;">
          <h2>Welcome to BuildMate</h2>
          <p>Please verify your email address to complete your registration.</p>
          <p style="margin: 24px 0;">
            <a href="${verificationUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Verify Email Address
            </a>
          </p>
          <p style="font-size: 13px; color: #6b7280;">
            This link will expire in 24 hours. If you did not create a BuildMate account, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error(`[Auth/Email] Resend API error sending to ${toEmail}:`, error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email delivery error";
    console.error(`[Auth/Email] Delivery exception sending to ${toEmail}:`, message);
    return { success: false, error: message };
  }
}

/**
 * Sends an account setup invitation link to an approved builder.
 */
export async function sendBuilderSetupEmail(
  toEmail: string,
  rawToken: string,
  builderName: string
): Promise<{ success: boolean; error?: string }> {
  const setupUrl = `${appUrl}/builder/setup?token=${encodeURIComponent(rawToken)}`;

  if (!resend) {
    if (process.env.NODE_ENV === "development") {
      console.info("\n=======================================================");
      console.info(`[Auth/Email] LOCAL DEV BUILDER SETUP LINK FOR ${toEmail}:`);
      console.info(setupUrl);
      console.info("=======================================================\n");
    } else {
      console.info(`[Auth/Email] Builder setup link generated for ${toEmail} (Email delivery skipped: Resend API key placeholder)`);
    }
    return { success: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: emailFrom,
      to: toEmail,
      subject: "Welcome to BuildMate — Set Up Your Builder Account",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6;">
          <h2>Congratulations ${builderName}!</h2>
          <p>Your application to join BuildMate as an approved software builder has been accepted by our review team.</p>
          <p>Please click the button below to set up your password and access your builder portal:</p>
          <p style="margin: 24px 0;">
            <a href="${setupUrl}" style="background-color: #171e19; color: #ffe17c; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Set Up Builder Account
            </a>
          </p>
          <p style="font-size: 13px; color: #6b7280;">
            This link is valid for 7 days. If you did not apply for BuildMate, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error(`[Auth/Email] Resend API error sending builder setup to ${toEmail}:`, error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email delivery error";
    console.error(`[Auth/Email] Delivery exception sending to ${toEmail}:`, message);
    return { success: false, error: message };
  }
}

/**
 * Sends a general notification email (e.g. admin alerts, system notifications).
 */
export async function sendNotificationEmail(
  toEmail: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[Email/DevMock] Notification to ${toEmail} | Subject: "${subject}"`);
    }
    return { success: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: emailFrom,
      to: toEmail,
      subject,
      html,
    });

    if (error) {
      console.error(`[Email] Resend error sending to ${toEmail}:`, error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email delivery error";
    console.error(`[Email] Delivery exception sending to ${toEmail}:`, message);
    return { success: false, error: message };
  }
}

/**
 * Best-effort fire-and-forget email delivery pattern for non-critical notifications.
 *
 * NOTE FOR VERCEL / SERVERLESS:
 * Vercel serverless function instances can freeze or terminate after the HTTP
 * response is sent. For V1 scale, best-effort fire-and-forget with error logging
 * is an intentional, acceptable architectural tradeoff to keep the DB connection lifecycle
 * and HTTP response critical path non-blocking. If a background delivery failure occurs,
 * it is caught and logged to standard error without crashing or blocking the client.
 */
export function sendEmailFireAndForget(
  toEmail: string,
  subject: string,
  html: string
): void {
  // Fire without blocking the response critical path, logging failures
  sendNotificationEmail(toEmail, subject, html).catch((err) => {
    console.error(`[Email/FireAndForget] Delivery error to ${toEmail}:`, err);
  });
}
