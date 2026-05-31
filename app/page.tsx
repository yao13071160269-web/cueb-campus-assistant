"use client";

import { useState, useEffect } from "react";
import LoginModal from "./_components/LoginModal";
import ChatInterface from "./_components/ChatInterface";

interface Student {
  studentId: string;
  name: string;
  major: string;
  college: string;
  grade: string;
  className: string;
}

export default function Home() {
  const [student, setStudent] = useState<Student | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedStudent = sessionStorage.getItem("cueb_student");
    const savedToken = sessionStorage.getItem("cueb_token");
    if (savedStudent && savedToken) {
      try {
        setStudent(JSON.parse(savedStudent));
        setToken(savedToken);
      } catch {
        sessionStorage.removeItem("cueb_student");
        sessionStorage.removeItem("cueb_token");
      }
    }
  }, []);

  function handleLogin(s: Student, t: string) {
    setStudent(s);
    setToken(t);
    sessionStorage.setItem("cueb_student", JSON.stringify(s));
    sessionStorage.setItem("cueb_token", t);
  }

  function handleLogout() {
    setStudent(null);
    setToken(null);
    sessionStorage.removeItem("cueb_student");
    sessionStorage.removeItem("cueb_token");
  }

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-cueb-red flex items-center justify-center mx-auto mb-4">
            <svg width="36" height="36" viewBox="0 0 56 40" fill="none">
              <ellipse cx="28" cy="16" rx="16" ry="10" fill="white" fillOpacity="0.9" />
              <ellipse cx="24" cy="8" rx="6" ry="5" fill="white" fillOpacity="0.7" />
              <ellipse cx="32" cy="9" rx="5" ry="4" fill="white" fillOpacity="0.7" />
              <ellipse cx="46" cy="10" rx="5" ry="4" fill="white" fillOpacity="0.9" />
              <path d="M38 14 Q42 8 46 10" stroke="white" strokeOpacity="0.9" strokeWidth="4" fill="none" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (!student || !token) {
    return <LoginModal onLogin={handleLogin} />;
  }

  return <ChatInterface student={student} token={token} onLogout={handleLogout} />;
}
