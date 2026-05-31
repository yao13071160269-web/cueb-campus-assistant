"use client";

import { useState } from "react";

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
      </div>
    </div>
  );
}
