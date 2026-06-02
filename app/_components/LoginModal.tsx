"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Student {
  studentId: string;
  name: string;
  major: string;
  college: string;
  grade: string;
  className: string;
}

interface LoginModalProps {
  onLogin: (student: Student, token: string) => void;
}

export default function LoginModal({ onLogin }: LoginModalProps) {
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWxPanel, setShowWxPanel] = useState(false);
  const [wxStatus, setWxStatus] = useState<{
    loggedIn: boolean;
    hasQrCode: boolean;
    isPolling: boolean;
    error: string;
  } | null>(null);
  const [wxLoading, setWxLoading] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWxStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/wechat?action=status");
      const data = await res.json();
      setWxStatus(data);
      if (data.loggedIn) {
        setQrBase64(null);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!showWxPanel) return;
    fetchWxStatus();
    const iv = setInterval(fetchWxStatus, 5000);
    return () => clearInterval(iv);
  }, [showWxPanel, fetchWxStatus]);

  // Cleanup poll interval on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startLoginPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/wechat?action=poll-login");
        const data = await res.json();
        if (data.status === "success") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setQrBase64(null);
          fetchWxStatus();
        } else if (data.status === "expired" || data.status === "no_pending") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setQrBase64(null);
          fetchWxStatus();
        }
      } catch { /* ignore */ }
    }, 2500);
  }

  async function handleRequestQr() {
    setWxLoading(true);
    try {
      const res = await fetch("/api/admin/wechat?action=qrcode", { method: "POST" });
      const data = await res.json();
      if (data.success && data.qrCodeBase64) {
        setQrBase64(data.qrCodeBase64);
        startLoginPolling();
      }
      fetchWxStatus();
    } catch { /* ignore */ }
    setWxLoading(false);
  }

  async function handleLogin(id?: string) {
    const loginId = id || studentId;
    if (!loginId.trim()) {
      setError("请输入学号");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: loginId }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        onLogin(data.student, data.token);
      } else {
        setError(data.message);
      }
    } catch {
      setError("登录失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  const showQr = qrBase64 || wxStatus?.hasQrCode;
  const isWaiting = wxStatus?.isPolling || !!pollRef.current;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="w-full max-w-md px-6">
        {/* Logo Area */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-cueb-red mb-5">
            <svg width="44" height="44" viewBox="0 0 56 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="28" cy="16" rx="16" ry="10" fill="white" fillOpacity="0.9" />
              <ellipse cx="24" cy="8" rx="6" ry="5" fill="white" fillOpacity="0.7" />
              <ellipse cx="32" cy="9" rx="5" ry="4" fill="white" fillOpacity="0.7" />
              <ellipse cx="46" cy="10" rx="5" ry="4" fill="white" fillOpacity="0.9" />
              <circle cx="48" cy="9" r="1" fill="#c41230" />
              <path d="M38 14 Q42 8 46 10" stroke="white" strokeOpacity="0.9" strokeWidth="4" fill="none" />
              <line x1="34" y1="24" x2="36" y2="36" stroke="white" strokeOpacity="0.7" strokeWidth="2.5" />
              <line x1="20" y1="24" x2="18" y2="36" stroke="white" strokeOpacity="0.7" strokeWidth="2.5" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">CUEB 校园助手</h1>
          <p className="mt-2 text-gray-500 text-sm">首都经济贸易大学 AI 智能体</p>
        </div>

        {/* Login Form */}
        <div className="space-y-4">
          <div>
            <input
              type="text"
              value={studentId}
              onChange={(e) => { setStudentId(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="请输入学号"
              className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-base
                         focus:outline-none focus:ring-2 focus:ring-cueb-red/30 focus:border-cueb-red
                         transition-all placeholder:text-gray-400"
              disabled={loading}
            />
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </div>

          <button
            onClick={() => handleLogin()}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-cueb-red text-white font-medium text-base
                       hover:bg-cueb-red-dark transition-colors disabled:opacity-50
                       flex items-center justify-center gap-2"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : null}
            {loading ? "登录中..." : "进入校园助手"}
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-gray-300">
          输入学号即可登录 · 数据已加密保护
        </p>

        {/* Admin WeChat Auth Panel */}
        <div className="mt-6 border-t border-gray-100 pt-5">
          <button
            onClick={() => setShowWxPanel(!showWxPanel)}
            className="w-full flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            管理员：微信公众号数据源配置
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`transition-transform ${showWxPanel ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {showWxPanel && (
            <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    wxStatus === null
                      ? "bg-gray-300"
                      : wxStatus.loggedIn
                        ? "bg-green-400"
                        : isWaiting
                          ? "bg-yellow-400 animate-pulse"
                          : "bg-red-400"
                  }`}
                />
                <span className="text-xs text-gray-600">
                  {wxStatus === null
                    ? "检查中..."
                    : wxStatus.loggedIn
                      ? "微信公众号平台已连接，文章数据自动更新中"
                      : isWaiting
                        ? "等待扫码确认..."
                        : "未连接微信公众号平台"}
                </span>
              </div>

              {wxStatus?.error && (
                <p className="text-xs text-red-500">{wxStatus.error}</p>
              )}

              {/* QR Code */}
              {showQr && (
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="p-2 bg-white rounded-lg border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrBase64
                        ? `data:image/png;base64,${qrBase64}`
                        : `/api/admin/wechat/qrcode?t=${Date.now()}`}
                      alt="微信扫码"
                      className="w-40 h-40 object-contain"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    用绑定了公众号的微信扫码
                  </p>
                </div>
              )}

              {/* Actions */}
              {!wxStatus?.loggedIn && !isWaiting && (
                <button
                  onClick={handleRequestQr}
                  disabled={wxLoading}
                  className="w-full h-9 rounded-lg bg-green-500 text-white text-xs font-medium
                             hover:bg-green-600 disabled:opacity-50 transition-colors
                             flex items-center justify-center gap-1.5"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8.813 2.002c-4.178.32-7.305 3.674-7.305 7.863 0 2.337.891 4.355 2.703 5.932l-.588 1.766 2.053-1.025c.895.277 1.687.416 2.377.416.228 0 .449-.012.667-.035a5.01 5.01 0 01-.2-1.395c0-2.956 2.507-5.361 5.592-5.361.366 0 .724.033 1.072.095-.35-3.48-3.504-6.204-7.171-6.452-.232-.016-.464-.016-.696-.016-.17 0-.34.008-.504.012zm-2.887 4.39c.502 0 .91.406.91.91 0 .502-.408.908-.91.908s-.91-.406-.91-.908c0-.504.408-.91.91-.91zm4.578 0c.502 0 .91.406.91.91 0 .502-.408.908-.91.908s-.91-.406-.91-.908c0-.504.408-.91.91-.91zM14.045 10.836c-2.58 0-4.676 1.908-4.676 4.266 0 2.356 2.096 4.264 4.676 4.264.549 0 1.074-.092 1.564-.264l1.611.803-.459-1.381c1.42-1.24 2.12-2.728 2.12-4.156 0-1.623-1.282-3.307-3.332-4.067a5.164 5.164 0 00-1.504-.465zm-1.586 2.555c.394 0 .714.32.714.714 0 .394-.32.714-.714.714s-.714-.32-.714-.714c0-.394.32-.714.714-.714zm3.172 0c.394 0 .714.32.714.714 0 .394-.32.714-.714.714s-.714-.32-.714-.714c0-.394.32-.714.714-.714z"/>
                  </svg>
                  {wxLoading ? "请求中..." : "获取微信登录二维码"}
                </button>
              )}

              {wxStatus?.loggedIn && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-green-600">
                    已连接 · 公众号文章自动同步
                  </p>
                  <button
                    onClick={async () => {
                      await fetch("/api/admin/wechat?action=logout", { method: "POST" });
                      fetchWxStatus();
                    }}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
                  >
                    断开连接
                  </button>
                </div>
              )}

              <p className="text-xs text-gray-300 text-center">
                仅管理员需要操作，学生用学号登录即可
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
