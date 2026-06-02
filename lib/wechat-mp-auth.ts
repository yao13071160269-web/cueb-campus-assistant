/**
 * WeChat MP Platform Scraper — TypeScript port of we-mp-rss core auth.
 * Handles QR code login, session management, and article fetching
 * via mp.weixin.qq.com APIs.
 *
 * Architecture: KV-backed (Upstash Redis on Vercel, in-memory locally).
 * Login polling is driven by client-side requests, not a server-side loop,
 * to stay within Vercel's serverless function timeout limits.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { kv } from "@/lib/kv-store";

const MP_BASE = "https://mp.weixin.qq.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const KV_SESSION = "wx:session";
const KV_QR_IMAGE = "wx:qrcode";
const KV_LOGIN_STATE = "wx:login-state";
const KV_ACCOUNT_CACHE = "wx:account-cache";

const SESSION_TTL = 4 * 24 * 3600; // 4 days
const QR_TTL = 300; // 5 minutes
const LOGIN_STATE_TTL = 300; // 5 minutes

// Local filesystem paths (used as secondary cache in local dev only)
const IS_VERCEL = !!process.env.VERCEL;
const QR_IMAGE_PATH = IS_VERCEL
  ? "/tmp/wx-qrcode.png"
  : path.join(process.cwd(), "public", "wx-qrcode.png");
const SESSION_PATH = IS_VERCEL
  ? "/tmp/wx-session.json"
  : path.join(process.cwd(), "data", "wx-session.json");

// ── Types ──

export interface WxSession {
  token: string;
  cookies: Record<string, string>;
  cookieString: string;
  fingerprint: string;
  loginTime: number;
  expiresAt: number;
}

interface LoginState {
  cookies: Record<string, string>;
  fingerprint: string;
  uuid: string;
  createdAt: number;
}

export interface WxArticle {
  aid: string;
  title: string;
  digest: string;
  link: string;
  cover: string;
  createTime: number;
}

export interface WxAccount {
  fakeid: string;
  nickname: string;
  alias: string;
  roundHeadImg: string;
}

// ── In-process cache (survives within same invocation / local dev) ──

let cachedSession: WxSession | null = null;
let cachedQrBuffer: Buffer | null = null;

// ── Helpers ──

function genUuid(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function parseCookies(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const m = line.match(/^([^=]+)=([^;]*)/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

function cookieStr(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function baseHeaders(cookies?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent": UA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    Referer: `${MP_BASE}/`,
  };
  if (cookies && Object.keys(cookies).length > 0) {
    h["Cookie"] = cookieStr(cookies);
  }
  return h;
}

// ── Session persistence (KV primary, filesystem secondary for local) ──

async function saveSession(s: WxSession): Promise<void> {
  cachedSession = s;
  await kv.set(KV_SESSION, s, SESSION_TTL);

  // Also save to local filesystem for local dev restart persistence
  if (!IS_VERCEL) {
    try {
      fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
      fs.writeFileSync(SESSION_PATH, JSON.stringify(s, null, 2));
    } catch { /* ignore */ }
  }
}

async function loadSession(): Promise<WxSession | null> {
  // 1. In-process cache
  if (cachedSession) {
    if (cachedSession.expiresAt && Date.now() > cachedSession.expiresAt) {
      cachedSession = null;
    } else {
      return cachedSession;
    }
  }

  // 2. KV store
  try {
    const s = await kv.get<WxSession>(KV_SESSION);
    if (s && s.expiresAt && Date.now() < s.expiresAt) {
      cachedSession = s;
      return s;
    }
  } catch { /* KV unavailable */ }

  // 3. Local filesystem (local dev only)
  if (!IS_VERCEL) {
    try {
      if (fs.existsSync(SESSION_PATH)) {
        const data = JSON.parse(
          fs.readFileSync(SESSION_PATH, "utf-8")
        ) as WxSession;
        if (data.expiresAt && Date.now() < data.expiresAt) {
          cachedSession = data;
          await kv.set(KV_SESSION, data, SESSION_TTL).catch(() => {});
          return data;
        }
      }
    } catch { /* ignore */ }
  }

  return null;
}

async function clearSession(): Promise<void> {
  cachedSession = null;
  await kv.del(KV_SESSION).catch(() => {});
  if (!IS_VERCEL) {
    try { if (fs.existsSync(SESSION_PATH)) fs.unlinkSync(SESSION_PATH); } catch { /* */ }
  }
}

// ── QR code storage ──

async function saveQrCode(buf: Buffer): Promise<void> {
  cachedQrBuffer = buf;
  const b64 = buf.toString("base64");
  await kv.set(KV_QR_IMAGE, b64, QR_TTL);

  if (!IS_VERCEL) {
    try {
      fs.mkdirSync(path.dirname(QR_IMAGE_PATH), { recursive: true });
      fs.writeFileSync(QR_IMAGE_PATH, buf);
    } catch { /* ignore */ }
  }
}

async function cleanQrCode(): Promise<void> {
  cachedQrBuffer = null;
  await kv.del(KV_QR_IMAGE).catch(() => {});
  await kv.del(KV_LOGIN_STATE).catch(() => {});
  if (!IS_VERCEL) {
    try { if (fs.existsSync(QR_IMAGE_PATH)) fs.unlinkSync(QR_IMAGE_PATH); } catch { /* */ }
  }
}

// ── Public API ──

export async function getStatus(): Promise<{
  loggedIn: boolean;
  hasQrCode: boolean;
  isPolling: boolean;
  error: string;
  loginTime?: number;
  expiresAt?: number;
}> {
  const s = await loadSession();
  const loginState = await kv.get<LoginState>(KV_LOGIN_STATE).catch(() => null);
  const hasQr =
    !!cachedQrBuffer ||
    !!(await kv.get(KV_QR_IMAGE).catch(() => null)) ||
    (!IS_VERCEL && fs.existsSync(QR_IMAGE_PATH));

  return {
    loggedIn: !!s,
    hasQrCode: hasQr,
    isPolling: !!loginState,
    error: "",
    loginTime: s?.loginTime,
    expiresAt: s?.expiresAt,
  };
}

/**
 * Step 1 of login: generate QR code.
 * Returns immediately. Client must then poll `pollOnce()`.
 */
export async function requestQrCode(): Promise<{
  success: boolean;
  message: string;
}> {
  const existingState = await kv.get<LoginState>(KV_LOGIN_STATE).catch(() => null);
  if (existingState && Date.now() - existingState.createdAt < 240_000) {
    return { success: false, message: "正在等待扫码，请勿重复请求" };
  }

  const cookies: Record<string, string> = {};

  try {
    const pageRes = await fetch(MP_BASE + "/", {
      headers: baseHeaders(),
      redirect: "manual",
    });
    Object.assign(cookies, parseCookies(pageRes.headers));

    const fingerprint = genUuid();
    const startRes = await fetch(
      `${MP_BASE}/cgi-bin/bizlogin?action=startlogin`,
      {
        method: "POST",
        headers: {
          ...baseHeaders(cookies),
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: new URLSearchParams({
          userlang: "zh_CN",
          token: "",
          lang: "zh_CN",
          f: "json",
          ajax: "1",
          login_type: "3",
          fingerprint,
        }).toString(),
        redirect: "manual",
      }
    );
    Object.assign(cookies, parseCookies(startRes.headers));

    const uuid = cookies["uuid"] || genUuid();

    const ts = Date.now();
    const qrUrl = `${MP_BASE}/cgi-bin/scanloginqrcode?action=getqrcode&uuid=${uuid}&random=${ts}`;
    const qrRes = await fetch(qrUrl, {
      headers: {
        ...baseHeaders(cookies),
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
        "Sec-Fetch-Dest": "image",
      },
    });

    if (!qrRes.ok) {
      return { success: false, message: `获取二维码失败: HTTP ${qrRes.status}` };
    }

    const contentType = qrRes.headers.get("content-type") || "";
    if (!contentType.includes("image")) {
      return { success: false, message: "获取二维码失败：返回内容不是图片" };
    }

    const imgBuf = Buffer.from(await qrRes.arrayBuffer());
    await saveQrCode(imgBuf);

    // Save login state to KV so subsequent pollOnce() calls can continue
    const loginState: LoginState = {
      cookies,
      fingerprint,
      uuid,
      createdAt: Date.now(),
    };
    await kv.set(KV_LOGIN_STATE, loginState, LOGIN_STATE_TTL);

    return { success: true, message: "二维码已生成，请使用微信扫码" };
  } catch (e) {
    return { success: false, message: `请求失败: ${(e as Error).message}` };
  }
}

/**
 * Step 2: single poll check. Client calls this every 2-3 seconds.
 * Returns: "waiting" | "scanned" | "success" | "expired" | "error"
 */
export async function pollOnce(): Promise<{
  status: "waiting" | "scanned" | "success" | "expired" | "error";
  message: string;
}> {
  const loginState = await kv.get<LoginState>(KV_LOGIN_STATE).catch(() => null);
  if (!loginState) {
    return { status: "expired", message: "登录状态已过期，请重新获取二维码" };
  }

  if (Date.now() - loginState.createdAt > 240_000) {
    await cleanQrCode();
    return { status: "expired", message: "二维码已过期，请重新获取" };
  }

  const { cookies, fingerprint } = loginState;

  try {
    const askRes = await fetch(
      `${MP_BASE}/cgi-bin/scanloginqrcode?` +
        new URLSearchParams({
          action: "ask",
          fingerprint,
          lang: "zh_CN",
          f: "json",
          ajax: "1",
        }),
      {
        headers: {
          ...baseHeaders(cookies),
          "X-Requested-With": "XMLHttpRequest",
        },
      }
    );

    const newCookies = parseCookies(askRes.headers);
    Object.assign(cookies, newCookies);
    // Persist updated cookies back to KV
    await kv.set(KV_LOGIN_STATE, { ...loginState, cookies }, LOGIN_STATE_TTL);

    const data = (await askRes.json()) as {
      status?: number;
      base_resp?: { ret: number };
      [key: string]: unknown;
    };

    if (String(JSON.stringify(data)).includes("invalid session")) {
      await cleanQrCode();
      return { status: "error", message: "会话无效，请重新获取二维码" };
    }

    const wxStatus = data.status ?? -1;

    if (wxStatus === 1 || wxStatus === 3) {
      // Login confirmed — finalize
      await finalizeLogin(cookies, fingerprint);
      await cleanQrCode();
      return { status: "success", message: "登录成功" };
    }

    if (wxStatus === 2 || wxStatus === 4) {
      return { status: "scanned", message: "已扫码，请在手机上确认" };
    }

    return { status: "waiting", message: "等待扫码..." };
  } catch (e) {
    return { status: "error", message: `轮询失败: ${(e as Error).message}` };
  }
}

async function finalizeLogin(
  cookies: Record<string, string>,
  fingerprint: string
): Promise<void> {
  const loginRes = await fetch(
    `${MP_BASE}/cgi-bin/bizlogin?action=login`,
    {
      method: "POST",
      headers: {
        ...baseHeaders(cookies),
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: new URLSearchParams({
        userlang: "zh_CN",
        redirect_url: "",
        cookie_forbidden: "0",
        cookie_cleaned: "0",
        plugin_used: "0",
        login_type: "3",
        fingerprint,
        token: "",
        lang: "zh_CN",
        f: "json",
        ajax: "1",
      }).toString(),
      redirect: "manual",
    }
  );

  Object.assign(cookies, parseCookies(loginRes.headers));
  const body = await loginRes.text();

  const tokenMatch = body.match(/token=(\d+)/);
  const token = tokenMatch?.[1] || "";
  if (!token) throw new Error("登录成功但未获取到token");

  const s: WxSession = {
    token,
    cookies,
    cookieString: cookieStr(cookies),
    fingerprint,
    loginTime: Date.now(),
    expiresAt: Date.now() + 4 * 24 * 3600 * 1000,
  };

  await saveSession(s);
}

/** Force logout */
export async function logout(): Promise<void> {
  await clearSession();
  await cleanQrCode();
}

/** Verify current session is still valid */
export async function verifySession(): Promise<boolean> {
  const s = await loadSession();
  if (!s) return false;
  try {
    const res = await fetch(
      `${MP_BASE}/cgi-bin/home?t=home/index&lang=zh_CN&token=${s.token}`,
      {
        headers: baseHeaders(s.cookies),
        redirect: "manual",
      }
    );
    const location = res.headers.get("location") || "";
    if (location.includes("loginpage") || res.status === 302) {
      await clearSession();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Get QR code image as Buffer */
export async function getQrCodeImage(): Promise<Buffer | null> {
  if (cachedQrBuffer) return cachedQrBuffer;

  // Try KV
  try {
    const b64 = await kv.get<string>(KV_QR_IMAGE);
    if (b64) {
      const buf = Buffer.from(b64, "base64");
      cachedQrBuffer = buf;
      return buf;
    }
  } catch { /* KV unavailable */ }

  // Try filesystem (local dev)
  if (!IS_VERCEL) {
    try {
      if (fs.existsSync(QR_IMAGE_PATH)) {
        return fs.readFileSync(QR_IMAGE_PATH);
      }
    } catch { /* ignore */ }
  }

  return null;
}

// ── Article Fetching ──

export async function searchAccount(query: string): Promise<WxAccount[]> {
  const s = await loadSession();
  if (!s) return [];

  try {
    const url =
      `${MP_BASE}/cgi-bin/searchbiz?` +
      new URLSearchParams({
        action: "search_biz",
        begin: "0",
        count: "5",
        query,
        token: s.token,
        lang: "zh_CN",
        f: "json",
        ajax: "1",
      });

    const res = await fetch(url, {
      headers: {
        ...baseHeaders(s.cookies),
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    const data = (await res.json()) as {
      list?: Array<{
        fakeid: string;
        nickname: string;
        alias: string;
        round_head_img: string;
      }>;
    };

    return (data.list || []).map((item) => ({
      fakeid: item.fakeid,
      nickname: item.nickname,
      alias: item.alias,
      roundHeadImg: item.round_head_img,
    }));
  } catch {
    return [];
  }
}

export async function fetchArticles(
  fakeid: string,
  begin = 0,
  count = 10
): Promise<WxArticle[]> {
  const s = await loadSession();
  if (!s) return [];

  try {
    const url =
      `${MP_BASE}/cgi-bin/appmsg?` +
      new URLSearchParams({
        action: "list_ex",
        begin: String(begin),
        count: String(count),
        fakeid,
        type: "9",
        query: "",
        token: s.token,
        lang: "zh_CN",
        f: "json",
        ajax: "1",
      });

    const res = await fetch(url, {
      headers: {
        ...baseHeaders(s.cookies),
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    const data = (await res.json()) as {
      app_msg_list?: Array<{
        aid: string;
        title: string;
        digest: string;
        link: string;
        cover: string;
        create_time: number;
      }>;
    };

    return (data.app_msg_list || []).map((a) => ({
      aid: a.aid || String(a.create_time),
      title: a.title,
      digest: a.digest,
      link: a.link,
      cover: a.cover,
      createTime: a.create_time,
    }));
  } catch {
    return [];
  }
}

// ── Convenience: fetch from all target accounts ──

const TARGET_ACCOUNTS = [
  "首经贸EDA创展",
  "CUEBCDA",
  "首都经济贸易大学学生处",
];

export async function fetchAllTargetArticles(): Promise<
  Array<WxArticle & { source: string }>
> {
  const s = await loadSession();
  if (!s) return [];

  // Load account cache from KV
  let accountMap: Record<string, string> = {};
  try {
    const cached = await kv.get<Record<string, string>>(KV_ACCOUNT_CACHE);
    if (cached) accountMap = cached;
  } catch { /* ignore */ }

  const allArticles: Array<WxArticle & { source: string }> = [];

  for (const name of TARGET_ACCOUNTS) {
    let fakeid = accountMap[name];
    if (!fakeid) {
      const results = await searchAccount(name);
      if (results.length > 0) {
        fakeid = results[0].fakeid;
        accountMap[name] = fakeid;
        await kv.set(KV_ACCOUNT_CACHE, accountMap, SESSION_TTL).catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    if (!fakeid) continue;

    const articles = await fetchArticles(fakeid, 0, 10);
    for (const a of articles) {
      allArticles.push({ ...a, source: name });
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  return allArticles;
}

export { TARGET_ACCOUNTS };
