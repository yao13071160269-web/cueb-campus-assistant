import { getQrCodeImage } from "@/lib/wechat-mp-auth";

export async function GET() {
  try {
    const buf = await getQrCodeImage();
    if (!buf) {
      return new Response("QR code not available", { status: 404 });
    }
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch {
    return new Response("Error reading QR code", { status: 500 });
  }
}
