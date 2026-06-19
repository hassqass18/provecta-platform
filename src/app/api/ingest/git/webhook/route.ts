import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";

// GitHub push webhook → enqueue a GIT_SYNC IngestJob (no inline processing).
// Gated: inert until a BrainRepo row exists. HMAC is verified over the raw bytes.

type PushCommit = { added?: string[]; modified?: string[] };
type PushBody = { ref?: string; before?: string; after?: string; commits?: PushCommit[] };

export async function GET() {
  // Handshake / readiness probe.
  return NextResponse.json({ status: "ready" });
}

export async function POST(req: Request) {
  // Raw body first — HMAC must be computed over the exact bytes received.
  const raw = await req.text();

  const repo = await prisma.brainRepo.findFirst();
  if (!repo) return NextResponse.json({ skipped: "no BrainRepo configured" });

  if (repo.webhookSecret) {
    const sig = req.headers.get("x-hub-signature-256");
    const expected = "sha256=" + crypto.createHmac("sha256", repo.webhookSecret).update(raw).digest("hex");
    const ok =
      !!sig &&
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let body: PushBody = {};
  try {
    body = JSON.parse(raw) as PushBody;
  } catch {
    body = {};
  }

  // Only act on pushes to the configured branch.
  if (body.ref === `refs/heads/${repo.branch}`) {
    await prisma.ingestJob.create({
      data: {
        kind: "GIT_SYNC",
        status: "PENDING",
        payload: {
          before: body.before ?? null,
          after: body.after ?? null,
          changedPaths: (body.commits ?? []).flatMap((c) => [...(c.added || []), ...(c.modified || [])]),
        },
      },
    });
  }

  // Return fast; a cron/worker drains the queue.
  return NextResponse.json({ ok: true, queued: true }, { status: 202 });
}
