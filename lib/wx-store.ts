/**
 * Storage abstraction for WeChat MP session data.
 * - If KV_REST_API_URL is set: uses Upstash Redis (Vercel production)
 * - Otherwise: uses in-memory + local filesystem (local development)
 */

import type { WxSession } from "./wechat-mp-auth";

export interface LoginState {
  uuid: string;
  cookies: Record<string, string>;
  fingerprint: string;
  createdAt: number;
}

const KEYS = {
  session: "wx:session",
  loginState: "wx:login-state",
  qrcode: "wx:qrcode",
} as const;

// TTLs in seconds
const SESSION_TTL = 4 * 24 * 3600; // 4 days
const LOGIN_STATE_TTL = 5 * 60; // 5 minutes (QR code expiry)
const QRCODE_TTL = 5 * 60;

// ── Redis-backed store (Vercel) ──

let redis: import("@upstash/redis").Redis | null = null;

function getRedis(): import("@upstash/redis").Redis | null {
  if (redis) return redis;
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  // Dynamic import at first call avoids bundling issues when KV isn't configured
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  redis = new Redis({ url, token });
  return redis;
}

// ── In-memory store (local dev fallback) ──

import fs from "fs";
import path from "path";

const SESSION_PATH = path.join(process.cwd(), "data", "wx-session.json");

const mem: {
  session: WxSession | null;
  loginState: LoginState | null;
  qrcode: string | null; // base64
} = {
  session: null,
  loginState: null,
  qrcode: null,
};

// ── Public API ──

export async function getSession(): Promise<WxSession | null> {
  const kv = getRedis();
  if (kv) {
    const data = await kv.get<WxSession>(KEYS.session);
    if (data && data.expiresAt && Date.now() > data.expiresAt) {
      await kv.del(KEYS.session);
      return null;
    }
    return data;
  }
  // Local: memory first, then disk
  if (mem.session) {
    if (mem.session.expiresAt && Date.now() > mem.session.expiresAt) {
      mem.session = null;
      return null;
    }
    return mem.session;
  }
  try {
    if (fs.existsSync(SESSION_PATH)) {
      const data = JSON.parse(fs.readFileSync(SESSION_PATH, "utf-8")) as WxSession;
      if (data.expiresAt && Date.now() > data.expiresAt) return null;
      mem.session = data;
      return data;
    }
  } catch { /* ignore */ }
  return null;
}

export async function saveSession(session: WxSession): Promise<void> {
  const kv = getRedis();
  if (kv) {
    await kv.set(KEYS.session, session, { ex: SESSION_TTL });
    return;
  }
  mem.session = session;
  try {
    fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
    fs.writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2));
  } catch { /* ignore on Vercel */ }
}

export async function deleteSession(): Promise<void> {
  const kv = getRedis();
  if (kv) {
    await kv.del(KEYS.session);
    return;
  }
  mem.session = null;
  try {
    if (fs.existsSync(SESSION_PATH)) fs.unlinkSync(SESSION_PATH);
  } catch { /* ignore */ }
}

export async function getLoginState(): Promise<LoginState | null> {
  const kv = getRedis();
  if (kv) {
    return await kv.get<LoginState>(KEYS.loginState);
  }
  return mem.loginState;
}

export async function saveLoginState(state: LoginState): Promise<void> {
  const kv = getRedis();
  if (kv) {
    await kv.set(KEYS.loginState, state, { ex: LOGIN_STATE_TTL });
    return;
  }
  mem.loginState = state;
}

export async function deleteLoginState(): Promise<void> {
  const kv = getRedis();
  if (kv) {
    await kv.del(KEYS.loginState);
    return;
  }
  mem.loginState = null;
}

export async function getQrCode(): Promise<string | null> {
  const kv = getRedis();
  if (kv) {
    return await kv.get<string>(KEYS.qrcode);
  }
  return mem.qrcode;
}

export async function saveQrCode(base64: string): Promise<void> {
  const kv = getRedis();
  if (kv) {
    await kv.set(KEYS.qrcode, base64, { ex: QRCODE_TTL });
    return;
  }
  mem.qrcode = base64;
}

export async function deleteQrCode(): Promise<void> {
  const kv = getRedis();
  if (kv) {
    await kv.del(KEYS.qrcode);
    return;
  }
  mem.qrcode = null;
}

export function isKVAvailable(): boolean {
  return getRedis() !== null;
}
