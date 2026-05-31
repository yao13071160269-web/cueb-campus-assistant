import { getLibraryStatus } from "@/lib/seat-engine";

export async function GET() {
  const statuses = getLibraryStatus();
  return Response.json({ statuses });
}
