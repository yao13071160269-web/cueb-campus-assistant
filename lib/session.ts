import crypto from "crypto";

const SESSION_TTL = 24 * 60 * 60 * 1000; // 24h

function getSecret(): string {
  return process.env.SESSION_SECRET || "fallback-dev-secret-do-not-use-in-prod";
}

export function createSessionToken(studentId: string): string {
  const payload = JSON.stringify({ sub: studentId, iat: Date.now() });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string): { valid: boolean; studentId?: string } {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return { valid: false };

    const expectedSig = crypto
      .createHmac("sha256", getSecret())
      .update(payloadB64)
      .digest("base64url");

    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return { valid: false };
    }

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (Date.now() - payload.iat > SESSION_TTL) {
      return { valid: false };
    }

    return { valid: true, studentId: payload.sub };
  } catch {
    return { valid: false };
  }
}

export function extractToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export function requireAuth(request: Request): { studentId: string } | Response {
  const token = extractToken(request);
  if (!token) {
    return Response.json({ error: "未登录，请先登录" }, { status: 401 });
  }
  const result = verifySessionToken(token);
  if (!result.valid || !result.studentId) {
    return Response.json({ error: "登录已过期，请重新登录" }, { status: 401 });
  }
  return { studentId: result.studentId };
}
