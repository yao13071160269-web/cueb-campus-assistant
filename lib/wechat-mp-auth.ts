/**
 * WeChat MP Platform Scraper — TypeScript port of we-mp-rss core auth
 * Handles QR code login, session management, and article fetching
 * via mp.weixin.qq.com APIs.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const MP_BASE = "https://mp.weixin.qq.com";
const QR_IMAGE_PATH = path.join(process.cwd(), "public", "wx-qrcode.png");
const SESSION_PATH = path.join(process.cwd(), "data", "wx-session.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// ── Types ──

export interface WxSession {
  token: string;
  cookies: Record<string, string>;
  cookieString: string;
  fingerprint: string;
  loginTime: number;
  expiresAt: number;
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

// ── State ──

let session: WxSession | null = null;
let loginUuid = "";
let isPolling = false;
let lastError = "";

// ── Helpers ──

function uuid(): string {
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

function mergeCookies(
  existing: Record<string, string>,
  incoming: Record<string, string>
): Record<string, string> {
  return { ...existing, ...incoming };
}

function cookieString(cookies: Record<string, string>): string {
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
    h["Cookie"] = cookieString(cookies);
  }
  return h;
}

// ── Session persistence ──

function saveSession(): void {
  if (!session) return;
  try {
    fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true });
    fs.writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2));
  } catch { /* ignore */ }
}

function loadSession(): WxSession | null {
  try {
    if (!fs.existsSync(SESSION_PATH)) return null;
    const data = JSON.parse(fs.readFileSync(SESSION_PATH, "utf-8")) as WxSession;
    if (data.expiresAt && Date.now() > data.expiresAt) return null;
    return data;
  } catch {
    return null;
  }
}

// ── Init: try restore session on module load ──
session = loadSession();

// ── Public API ──

/** Current login status */
export function getStatus(): {
  loggedIn: boolean;
  hasQrCode: boolean;
  isPolling: boolean;
  error: string;
  loginTime?: number;
  expiresAt?: number;
} {
  return {
    loggedIn: !!session,
    hasQrCode: fs.existsSync(QR_IMAGE_PATH),
    isPolling,
    error: lastError,
    loginTime: session?.loginTime,
    expiresAt: session?.expiresAt,
  };
}

/** Request a new QR code for scanning */
export async function requestQrCode(): Promise<{
  success: boolean;
  message: string;
}> {
  if (isPolling) {
    return { success: false, message: "正在等待扫码，请勿重复请求" };
  }

  lastError = "";
  const cookies: Record<string, string> = {};

  try {
    // 1. Visit login page to get initial cookies
    const pageRes = await fetch(MP_BASE + "/", {
      headers: baseHeaders(),
      redirect: "manual",
    });
    Object.assign(cookies, parseCookies(pageRes.headers));

    // 2. Start login flow
    const fingerprint = uuid();
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

    loginUuid = cookies["uuid"] || uuid();

    // 3. Download QR code image
    const ts = Date.now();
    const qrUrl = `${MP_BASE}/cgi-bin/scanloginqrcode?action=getqrcode&uuid=${loginUuid}&random=${ts}`;
    const qrRes = await fetch(qrUrl, {
      headers: {
        ...baseHeaders(cookies),
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
        "Sec-Fetch-Dest": "image",
      },
    });

    if (!qrRes.ok) {
      lastError = `获取二维码失败: HTTP ${qrRes.status}`;
      return { success: false, message: lastError };
    }

    const contentType = qrRes.headers.get("content-type") || "";
    if (!contentType.includes("image")) {
      lastError = "获取二维码失败：返回内容不是图片";
      return { success: false, message: lastError };
    }

    const imgBuf = Buffer.from(await qrRes.arrayBuffer());
    fs.mkdirSync(path.dirname(QR_IMAGE_PATH), { recursive: true });
    fs.writeFileSync(QR_IMAGE_PATH, imgBuf);

    // 4. Start polling login status in background
    isPolling = true;
    pollLoginStatus(cookies, fingerprint).catch(() => {
      isPolling = false;
    });

    return { success: true, message: "二维码已生成，请使用微信扫码" };
  } catch (e) {
    lastError = `请求失败: ${(e as Error).message}`;
    return { success: false, message: lastError };
  }
}

/** Background poll for login completion */
async function pollLoginStatus(
  cookies: Record<string, string>,
  fingerprint: string
): Promise<void> {
  const maxAttempts = 120; // ~4 minutes
  for (let i = 0; i < maxAttempts && isPolling; i++) {
    await new Promise((r) => setTimeout(r, 2000));

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

      Object.assign(cookies, parseCookies(askRes.headers));
      const data = (await askRes.json()) as {
        status?: number;
        base_resp?: { ret: number };
        [key: string]: unknown;
      };

      if (String(data).includes("invalid session")) {
        lastError = "会话无效，请重新获取二维码";
        break;
      }

      const status = data.status ?? -1;

      if (status === 1 || status === 3) {
        // Login success — finalize
        await finalizeLogin(cookies, fingerprint);
        break;
      }
      // status 2/4 = scanned, waiting for confirm — continue polling
    } catch {
      // network blip, retry
    }
  }

  isPolling = false;
  cleanQrCode();
}

async function finalizeLogin(
  cookies: Record<string, string>,
  fingerprint: string
): Promise<void> {
  try {
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

    // Extract token from redirect URL in response
    const tokenMatch = body.match(/token=(\d+)/);
    const token = tokenMatch?.[1] || "";

    if (!token) {
      lastError = "登录成功但未获取到token";
      return;
    }

    session = {
      token,
      cookies,
      cookieString: cookieString(cookies),
      fingerprint,
      loginTime: Date.now(),
      expiresAt: Date.now() + 4 * 24 * 3600 * 1000, // ~4 days
    };

    saveSession();
    lastError = "";
  } catch (e) {
    lastError = `登录完成步骤失败: ${(e as Error).message}`;
  }
}

function cleanQrCode(): void {
  try {
    if (fs.existsSync(QR_IMAGE_PATH)) fs.unlinkSync(QR_IMAGE_PATH);
  } catch { /* ignore */ }
}

/** Force logout */
export function logout(): void {
  session = null;
  isPolling = false;
  cleanQrCode();
  try {
    if (fs.existsSync(SESSION_PATH)) fs.unlinkSync(SESSION_PATH);
  } catch { /* ignore */ }
}

/** Verify current session is still valid */
export async function verifySession(): Promise<boolean> {
  if (!session) return false;
  try {
    const res = await fetch(
      `${MP_BASE}/cgi-bin/home?t=home/index&lang=zh_CN&token=${session.token}`,
      {
        headers: baseHeaders(session.cookies),
        redirect: "manual",
      }
    );
    // If we get redirected to login page, session is invalid
    const location = res.headers.get("location") || "";
    if (location.includes("loginpage") || res.status === 302) {
      session = null;
      try { fs.unlinkSync(SESSION_PATH); } catch { /* */ }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ── Article Fetching ──

/** Search for a WeChat Official Account by name */
export async function searchAccount(
  query: string
): Promise<WxAccount[]> {
  if (!session) return [];

  try {
    const url =
      `${MP_BASE}/cgi-bin/searchbiz?` +
      new URLSearchParams({
        action: "search_biz",
        begin: "0",
        count: "5",
        query,
        token: session.token,
        lang: "zh_CN",
        f: "json",
        ajax: "1",
      });

    const res = await fetch(url, {
      headers: {
        ...baseHeaders(session.cookies),
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

/** Fetch articles from a specific account by fakeid */
export async function fetchArticles(
  fakeid: string,
  begin = 0,
  count = 10
): Promise<WxArticle[]> {
  if (!session) return [];

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
        token: session.token,
        lang: "zh_CN",
        f: "json",
        ajax: "1",
      });

    const res = await fetch(url, {
      headers: {
        ...baseHeaders(session.cookies),
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

let accountCache: Map<string, string> = new Map(); // name → fakeid

export async function fetchAllTargetArticles(): Promise<
  Array<WxArticle & { source: string }>
> {
  if (!session) return [];

  const allArticles: Array<WxArticle & { source: string }> = [];

  for (const name of TARGET_ACCOUNTS) {
    let fakeid = accountCache.get(name);
    if (!fakeid) {
      const results = await searchAccount(name);
      if (results.length > 0) {
        fakeid = results[0].fakeid;
        accountCache.set(name, fakeid);
      }
      // Rate limit: WeChat MP has request frequency limits
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

export { TARGET_ACCOUNTS, QR_IMAGE_PATH };
