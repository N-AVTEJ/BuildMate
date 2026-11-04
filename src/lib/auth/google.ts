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

export function getAppBaseUrl(req?: Request): string {
  // If request is from localhost / local development, always normalize to http://localhost:<port>
  if (req) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (host && (host.includes("localhost") || host.includes("127.0.0.1") || host.includes("::1"))) {
      const portMatch = host.match(/:(\d+)$/);
      const port = portMatch ? portMatch[1] : "3000";
      return `http://localhost:${port}`;
    }

    // Match deployed domain directly from incoming request, normalizing any typo
    if (host) {
      const normalizedHost = host.replace("nbuildmmate.vercel.app", "nbuildmate.vercel.app");
      const proto = req.headers.get("x-forwarded-proto") || "https";
      return `${proto}://${normalizedHost}`;
    }
  }

  // In production, if canonical APP_URL is explicitly configured with https, check if it's the old domain
  if (process.env.APP_URL && process.env.APP_URL.trim().startsWith("https://")) {
    const envUrl = process.env.APP_URL.trim().replace(/\/$/, "");
    if (!envUrl.includes("navtejbuildmate")) {
      return envUrl.replace("nbuildmmate.vercel.app", "nbuildmate.vercel.app");
    }
  }

  // Fallbacks for environment variables
  if (process.env.APP_URL && !process.env.APP_URL.includes("navtejbuildmate")) {
    return process.env.APP_URL.trim().replace(/\/$/, "").replace("nbuildmmate.vercel.app", "nbuildmate.vercel.app");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim().replace(/\/$/, "").replace("nbuildmmate.vercel.app", "nbuildmate.vercel.app")}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/$/, "").replace("nbuildmmate.vercel.app", "nbuildmate.vercel.app")}`;
  }

  // Canonical production fallback strictly matching registered Google OAuth origin
  if (process.env.NODE_ENV === "production") {
    return "https://nbuildmate.vercel.app";
  }

  return "http://localhost:3000";
}

export function getGoogleRedirectUri(req?: Request): string {
  return `${getAppBaseUrl(req)}/api/auth/google/callback`;
}

export function generateOAuthState(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function getGoogleAuthUrl(state: string, req?: Request): string {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured in environment variables.");
  }

  const redirectUri = getGoogleRedirectUri(req);
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

export async function exchangeGoogleCode(code: string, redirectUriOverride?: string): Promise<GoogleTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = redirectUriOverride || getGoogleRedirectUri();

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
