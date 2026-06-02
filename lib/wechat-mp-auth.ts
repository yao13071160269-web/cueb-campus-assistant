/**
 * WeChat MP Platform Scraper — TypeScript port of we-mp-rss core auth.
 * Handles QR code login, session management, and article fetching
 * via mp.weixin.qq.com APIs.
 *
 * Storage: delegated to wx-store.ts (Upstash Redis on Vercel, memory+fs locally).
 * Polling: client-driven — each call to checkLoginOnce() does ONE check.
 */

import crypto from "crypto";
import * as store from "./wx-store";
import type { LoginState } from "./wx-store";

const MP_BASE = "https://mp.weixin.qq.com";

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

// ── Public API ──

/** Current login status (async — reads from store) */
export async function getStatus(): Promise<{
  loggedIn: boolean;
  hasQrCode: boolean;
  isPolling: boolean;
  error: string;
  loginTime?: number;
  expiresAt?: number;
}> {
  const session = await store.getSession();
  const loginState = await store.getLoginState();
  const qr = await store.getQrCode();

  return {
    loggedIn: !!session,
    hasQrCode: !!qr,
    isPolling: !!loginState,
    error: "",
    loginTime: session?.loginTime,
    expiresAt: session?.expiresAt,
  };
}

/**
 * Request a new QR code for scanning.
 * Returns { success, message, qrCodeBase64? }.
 * Does NOT start background polling — the frontend calls checkLoginOnce() repeatedly.
 */
export async function requestQrCode(): Promise<{
  success: boolean;
  message: string;
  qrCodeBase64?: string;
}> {
  const existing = await store.getLoginState();
  if (existing) {
    const qr = await store.getQrCode();
    if (qr) {
      return { success: true, message: "二维码已存在，请扫码", qrCodeBase64: qr };
    }
  }

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

    const loginUuid = cookies["uuid"] || uuid();

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
      return { success: false, message: `获取二维码失败: HTTP ${qrRes.status}` };
    }

    const contentType = qrRes.headers.get("content-type") || "";
    if (!contentType.includes("image")) {
      return { success: false, message: "获取二维码失败：返回内容不是图片" };
    }

    const imgBuf = Buffer.from(await qrRes.arrayBuffer());
    const qrCodeBase64 = imgBuf.toString("base64");

    // 4. Persist login state and QR code to store
    const loginState: LoginState = {
      uuid: loginUuid,
      cookies,
      fingerprint,
      createdAt: Date.now(),
    };

    await store.saveLoginState(loginState);
    await store.saveQrCode(qrCodeBase64);

    return { success: true, message: "二维码已生成，请使用微信扫码", qrCodeBase64 };
  } catch (e) {
    return { success: false, message: `请求失败: ${(e as Error).message}` };
  }
}

/**
 * Check login status ONCE. Called by the frontend every 2-3 seconds.
 * Returns { status: "no_pending" | "waiting" | "scanned" | "success" | "expired" }
 */
export async function checkLoginOnce(): Promise<{
  status: "no_pending" | "waiting" | "scanned" | "success" | "expired";
  error?: string;
}> {
  const loginState = await store.getLoginState();
  if (!loginState) {
    return { status: "no_pending" };
  }

  // QR codes expire after ~5 min
  if (Date.now() - loginState.createdAt > 5 * 60 * 1000) {
    await store.deleteLoginState();
    await store.deleteQrCode();
    return { status: "expired" };
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
    const mergedCookies = mergeCookies(cookies, newCookies);

    const data = (await askRes.json()) as {
      status?: number;
      base_resp?: { ret: number };
      [key: string]: unknown;
    };

    if (String(data).includes("invalid session")) {
      await store.deleteLoginState();
      await store.deleteQrCode();
      return { status: "expired", error: "会话无效" };
    }

    const wxStatus = data.status ?? -1;

    if (wxStatus === 1 || wxStatus === 3) {
      // Login success — finalize
      const session = await finalizeLogin(mergedCookies, fingerprint);
      if (session) {
        await store.deleteLoginState();
        await store.deleteQrCode();
        return { status: "success" };
      }
      return { status: "waiting", error: "登录完成步骤失败" };
    }

    if (wxStatus === 2 || wxStatus === 4) {
      // Scanned, waiting for confirm
      // Update cookies in login state
      await store.saveLoginState({ ...loginState, cookies: mergedCookies });
      return { status: "scanned" };
    }

    return { status: "waiting" };
  } catch (e) {
    return { status: "waiting", error: (e as Error).message };
  }
}

async function finalizeLogin(
  cookies: Record<string, string>,
  fingerprint: string
): Promise<WxSession | null> {
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

    const tokenMatch = body.match(/token=(\d+)/);
    const token = tokenMatch?.[1] || "";

    if (!token) return null;

    const session: WxSession = {
      token,
      cookies,
      cookieString: cookieStr(cookies),
      fingerprint,
      loginTime: Date.now(),
      expiresAt: Date.now() + 4 * 24 * 3600 * 1000,
    };

    await store.saveSession(session);
    return session;
  } catch {
    return null;
  }
}

/** Force logout */
export async function logout(): Promise<void> {
  await store.deleteSession();
  await store.deleteLoginState();
  await store.deleteQrCode();
}

/** Verify current session is still valid */
export async function verifySession(): Promise<boolean> {
  const session = await store.getSession();
  if (!session) return false;
  try {
    const res = await fetch(
      `${MP_BASE}/cgi-bin/home?t=home/index&lang=zh_CN&token=${session.token}`,
      {
        headers: baseHeaders(session.cookies),
        redirect: "manual",
      }
    );
    const location = res.headers.get("location") || "";
    if (location.includes("loginpage") || res.status === 302) {
      await store.deleteSession();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ── Article Fetching ──

/** Search for a WeChat Official Account by name */
export async function searchAccount(query: string): Promise<WxAccount[]> {
  const session = await store.getSession();
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
  const session = await store.getSession();
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

const accountCache: Map<string, string> = new Map(); // name → fakeid

export async function fetchAllTargetArticles(): Promise<
  Array<WxArticle & { source: string }>
> {
  const session = await store.getSession();
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
