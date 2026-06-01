import fs from "fs";
import { QR_IMAGE_PATH, getQrCodeBuffer } from "@/lib/wechat-mp-auth";

export async function GET() {
  try {
    // Prefer in-memory buffer (works on Vercel serverless)
    const memBuf = getQrCodeBuffer();
    if (memBuf) {
      return new Response(new Uint8Array(memBuf), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-cache, no-store",
        },
      });
    }

    // Fallback: read from filesystem (local dev)
    if (fs.existsSync(QR_IMAGE_PATH)) {
      const buf = fs.readFileSync(QR_IMAGE_PATH);
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-cache, no-store",
        },
      });
    }

    return new Response("QR code not available", { status: 404 });
  } catch {
    return new Response("Error reading QR code", { status: 500 });
  }
}
