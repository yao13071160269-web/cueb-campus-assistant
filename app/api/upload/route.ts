import { rateLimitGuard } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/session";

const OFFICE_EXTENSIONS = new Set([
  "pdf", "docx", "doc", "pptx", "ppt", "xlsx", "xls",
  "odt", "odp", "ods", "rtf", "csv",
]);

const CODE_EXTENSIONS = new Set([
  "py", "js", "ts", "tsx", "jsx", "java", "c", "cpp", "cc", "h", "hpp",
  "cs", "go", "rs", "rb", "php", "swift", "kt", "scala", "r",
  "sql", "sh", "bash", "bat", "ps1",
  "json", "xml", "yaml", "yml", "toml", "ini", "env",
  "html", "htm", "css", "scss", "less", "svg",
  "txt", "md", "markdown", "log", "conf", "cfg",
  "vue", "svelte", "astro",
  "dockerfile", "makefile", "gitignore",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_LENGTH = 8000;

function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function truncateText(text: string, maxLen: number): { text: string; truncated: boolean } {
  if (text.length <= maxLen) return { text, truncated: false };
  return {
    text: text.slice(0, maxLen) + "\n\n...[内容过长，已截断]",
    truncated: true,
  };
}

export async function POST(request: Request) {
  const blocked = rateLimitGuard(request, 10);
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "未上传文件" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "文件大小不能超过 10MB" }, { status: 400 });
    }

    const ext = getExtension(file.name);

    if (!OFFICE_EXTENSIONS.has(ext) && !CODE_EXTENSIONS.has(ext)) {
      return Response.json(
        { error: `不支持的文件格式: .${ext}` },
        { status: 400 }
      );
    }

    let extractedText = "";
    let fileType = "unknown";

    if (OFFICE_EXTENSIONS.has(ext)) {
      fileType = "document";
      const { parseOffice } = await import("officeparser");
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await parseOffice(buffer, { outputErrorToConsole: false });
      // officeparser v7 returns AST; convert to text
      if (typeof result === "string") {
        extractedText = result;
      } else if (result && typeof result === "object") {
        // AST object — use .to('text') or toString
        if (typeof (result as { to?: (f: string) => Promise<{ value: string }> }).to === "function") {
          const textResult = await (result as { to: (f: string) => Promise<{ value: string }> }).to("text");
          extractedText = textResult.value || String(textResult);
        } else {
          extractedText = JSON.stringify(result, null, 2);
        }
      }
    } else {
      fileType = "code";
      const buffer = await file.arrayBuffer();
      extractedText = new TextDecoder("utf-8").decode(buffer);
    }

    if (!extractedText.trim()) {
      return Response.json(
        { error: "无法从文件中提取文本内容" },
        { status: 422 }
      );
    }

    const { text, truncated } = truncateText(extractedText.trim(), MAX_TEXT_LENGTH);

    return Response.json({
      filename: file.name,
      size: file.size,
      type: fileType,
      extension: ext,
      content: text,
      truncated,
    });
  } catch (e) {
    console.error("Upload parse error:", e);
    return Response.json(
      { error: `文件解析失败: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
