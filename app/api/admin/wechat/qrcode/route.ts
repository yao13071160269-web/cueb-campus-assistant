import { getQrCode } from "@/lib/wx-store";

export async function GET() {
  try {
    const base64 = await getQrCode();
    if (!base64) {
      return new Response("QR code not available", { status: 404 });
    }
    const buf = Buffer.from(base64, "base64");
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
