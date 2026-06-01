import fs from "fs";
import { QR_IMAGE_PATH } from "@/lib/wechat-mp-auth";

export async function GET() {
  try {
    if (!fs.existsSync(QR_IMAGE_PATH)) {
      return new Response("QR code not available", { status: 404 });
    }
    const buf = fs.readFileSync(QR_IMAGE_PATH);
    return new Response(buf, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch {
    return new Response("Error reading QR code", { status: 500 });
  }
}
