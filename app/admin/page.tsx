"use client";

import { useState, useEffect, useCallback } from "react";

interface StatusData {
  loggedIn: boolean;
  hasQrCode: boolean;
  isPolling: boolean;
  error: string;
  loginTime?: number;
  expiresAt?: number;
}

interface Article {
  aid: string;
  title: string;
  digest: string;
  link: string;
  cover: string;
  createTime: number;
  source: string;
}

export default function AdminPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingArticles, setFetchingArticles] = useState(false);
  const [qrTimestamp, setQrTimestamp] = useState(0);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/wechat?action=status");
      const data: StatusData = await res.json();
      setStatus(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleRequestQr = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/wechat?action=qrcode", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setQrTimestamp(Date.now());
      } else {
        alert(data.message || "获取二维码失败");
      }
    } catch {
      alert("请求失败");
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await fetch("/api/admin/wechat?action=logout", { method: "POST" });
    setArticles([]);
    fetchStatus();
  };

  const handleFetchArticles = async () => {
    setFetchingArticles(true);
    try {
      const res = await fetch("/api/admin/wechat?action=articles");
      const data = await res.json();
      setArticles(data.articles || []);
    } catch {
      alert("获取文章失败");
    }
    setFetchingArticles(false);
  };

  const formatTime = (ts: number) => {
    if (!ts) return "-";
    return new Date(ts).toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              微信公众号监控
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              内置微信公众号平台接入 · 无需 Docker
            </p>
          </div>
          <a href="/" className="text-sm text-cueb-red hover:underline">
            返回首页
          </a>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 mb-3">登录状态</h2>
          <div className="flex items-center gap-3">
            <span
              className={`w-3 h-3 rounded-full ${
                status === null
                  ? "bg-gray-300"
                  : status.loggedIn
                    ? "bg-green-400"
                    : status.isPolling
                      ? "bg-yellow-400 animate-pulse"
                      : "bg-red-400"
              }`}
            />
            <span className="text-sm font-medium">
              {status === null
                ? "检查中..."
                : status.loggedIn
                  ? "已登录微信公众号平台"
                  : status.isPolling
                    ? "等待扫码中..."
                    : "未登录"}
            </span>
          </div>

          {status?.loggedIn && (
            <div className="mt-3 text-xs text-gray-400 space-y-1">
              <p>登录时间：{formatTime(status.loginTime || 0)}</p>
              <p>过期时间：{formatTime(status.expiresAt || 0)}</p>
            </div>
          )}

          {status?.error && (
            <p className="mt-2 text-xs text-red-500">{status.error}</p>
          )}

          <div className="mt-4 flex gap-3">
            {!status?.loggedIn && !status?.isPolling && (
              <button
                onClick={handleRequestQr}
                disabled={loading}
                className="px-4 py-2 bg-cueb-red text-white text-sm rounded-lg hover:bg-cueb-red-dark disabled:opacity-50 transition-colors"
              >
                {loading ? "请求中..." : "获取登录二维码"}
              </button>
            )}
            {status?.loggedIn && (
              <>
                <button
                  onClick={handleFetchArticles}
                  disabled={fetchingArticles}
                  className="px-4 py-2 bg-cueb-red text-white text-sm rounded-lg hover:bg-cueb-red-dark disabled:opacity-50 transition-colors"
                >
                  {fetchingArticles ? "获取中..." : "拉取最新文章"}
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
                >
                  退出登录
                </button>
              </>
            )}
          </div>
        </div>

        {/* QR Code Card */}
        {(status?.hasQrCode || status?.isPolling) && (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-bold text-gray-900 mb-3">扫码登录</h2>
            <div className="flex flex-col items-center gap-4">
              {status.hasQrCode && (
                <div className="p-3 bg-white border-2 border-gray-200 rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/admin/wechat/qrcode?t=${qrTimestamp}`}
                    alt="微信扫码"
                    className="w-48 h-48 object-contain"
                  />
                </div>
              )}
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-gray-700">
                  请使用微信扫描二维码
                </p>
                <p className="text-xs text-gray-400">
                  扫码后在手机上确认登录即可
                </p>
                {status.isPolling && (
                  <p className="text-xs text-yellow-600 animate-pulse">
                    正在等待扫码确认...
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Articles */}
        {articles.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-bold text-gray-900 mb-3">
              最新文章
              <span className="text-sm font-normal text-gray-400 ml-2">
                共 {articles.length} 篇
              </span>
            </h2>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {articles.map((a) => (
                <a
                  key={a.aid}
                  href={a.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg border border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex gap-3">
                    {a.cover && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={a.cover}
                        alt=""
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">
                        {a.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                        {a.digest}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-cueb-red">
                          {a.source}
                        </span>
                        <span className="text-xs text-gray-300">
                          {formatTime(a.createTime * 1000)}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 mb-3">使用说明</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cueb-red text-white text-xs flex items-center justify-center">
                1
              </span>
              <div>
                <p className="font-medium text-gray-900">点击「获取登录二维码」</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  系统会从微信公众号平台获取一个登录二维码
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cueb-red text-white text-xs flex items-center justify-center">
                2
              </span>
              <div>
                <p className="font-medium text-gray-900">使用微信扫码并确认</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  用绑定了微信公众号的微信扫码，在手机上确认登录
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cueb-red text-white text-xs flex items-center justify-center">
                3
              </span>
              <div>
                <p className="font-medium text-gray-900">自动抓取文章</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  登录后系统自动从「首经贸EDA创展」「CUEBCDA」「首都经济贸易大学学生处」获取最新文章
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 space-y-1">
            <p className="font-medium">提示</p>
            <p>
              扫码需要使用绑定了任意微信公众号的微信号（包括免费的个人订阅号）。
              没有公众号可以在{" "}
              <a
                href="https://mp.weixin.qq.com/cgi-bin/registermidpage"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                mp.weixin.qq.com
              </a>{" "}
              免费注册一个。登录有效期约 4 天。
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 mb-3">工作原理</h2>
          <div className="text-sm text-gray-500 space-y-1">
            <p>
              <strong className="text-gray-700">扫码登录</strong> →
              获取微信公众号平台访问权限（session cookies）
            </p>
            <p>
              → 通过平台 API 自动搜索并抓取目标公众号的<strong className="text-gray-700">最新文章</strong>
            </p>
            <p>
              → 含「课堂」「预约」等关键词的文章自动推送到<strong className="text-gray-700">通知中心</strong>
            </p>
            <p>
              → 用户通过 AI 对话即可查询公众号最新活动
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
