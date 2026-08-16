import "server-only";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { AuthError } from "@/lib/errors";

export const SESSION_COOKIE = "nexora_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload extends JWTPayload {
  sub: string; // userId
  ws?: string; // active workspaceId
  ver?: number;
}

const secretKey = new TextEncoder().encode(config.authSecret);

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("nexora")
    .setAudience("nexora-app")
    .setExpirationTime("30d")
    .sign(secretKey);
}

export async function verifySessionToken(token: string): Promise<SessionPayload> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: "nexora",
      audience: "nexora-app",
    });
    if (!payload.sub) throw new AuthError("Invalid session");
    return payload as SessionPayload;
  } catch {
    throw new AuthError("Invalid or expired session");
  }
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function updateSessionWorkspace(workspaceId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await setSessionCookie({ ...session, ws: workspaceId });
}
