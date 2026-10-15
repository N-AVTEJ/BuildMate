import crypto from "crypto";

export interface GoogleTokens {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
  refresh_token?: string;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email_verified: boolean;
}

export function getAppBaseUrl(): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.trim().replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.trim()}`;
  }
  return "http://localhost:3000";
}

export function getGoogleRedirectUri(): string {
  return `${getAppBaseUrl()}/api/auth/google/callback`;
}

export function generateOAuthState(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function getGoogleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured in environment variables.");
  }

  const redirectUri = getGoogleRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<GoogleTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = getGoogleRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials (GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET) are missing.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Failed to exchange Google OAuth code.");
  }

  return data as GoogleTokens;
}

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || "Failed to retrieve Google user profile.");
  }

  return data as GoogleUserInfo;
}
