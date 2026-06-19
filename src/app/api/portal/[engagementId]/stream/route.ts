import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { getSnapshot } from "@/server/dashboards/metrics";

// SSE stream of engagement health snapshots. Best-effort and intentionally
// short-lived (bounded loop) so it stays inside Vercel function limits — the
// client poll is the real freshness guarantee; this is a low-latency nudge.

const MAX_ITERATIONS = 5;
const INTERVAL_MS = 10_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function GET(req: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = await params;

  const user = await currentUser();
  if (!user?.tenantId) {
    return new Response("unauthorized", { status: 401 });
  }

  // Authorize: the engagement must belong to the caller's tenant.
  const eng = await prisma.engagement.findFirst({
    where: { id: engagementId, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!eng) {
    return new Response("not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = async () => {
        const snap = await getSnapshot(engagementId);
        controller.enqueue(encoder.encode(`event: snapshot-updated\ndata: ${JSON.stringify(snap)}\n\n`));
      };

      try {
        await emit();
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          if (req.signal.aborted) break;
          await sleep(INTERVAL_MS);
          if (req.signal.aborted) break;
          await emit();
        }
      } catch {
        // Best-effort: swallow (client likely disconnected) and close cleanly.
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
