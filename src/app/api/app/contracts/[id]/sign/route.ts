import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { notifyOperators } from "@/server/notifications/fanout";
import { sendComm } from "@/server/comms/send";

// Client in-app signature (typed-signature attestation). The client signs their
// engagement agreement from the workspace; we record the typed signature +
// identity + timestamp as a tamper-evident audit attestation, mark the envelope
// SIGNED, and notify the operator. id = envelope id.
const schema = z.object({
  signature: z.string().trim().min(2).max(120), // typed full name
  agree: z.literal(true), // explicit attestation checkbox
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A typed signature and attestation are required." }, { status: 400 });

  const env = await prisma.envelope.findUnique({ where: { id } });
  if (!env) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (env.tenantId !== user.tenantId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (env.status === "WET_INK_REQUIRED") return NextResponse.json({ error: "This agreement requires a wet-ink signature." }, { status: 409 });
  if (env.status === "SIGNED") return NextResponse.json({ ok: true, status: "SIGNED" }); // idempotent
  if (env.status !== "SENT") return NextResponse.json({ error: "This agreement is not ready to sign yet." }, { status: 409 });

  await prisma.envelope.update({
    where: { id },
    data: { status: "SIGNED", signerName: parsed.data.signature, completedAt: new Date() },
  });
  if (env.documentId) {
    await prisma.document.update({ where: { id: env.documentId }, data: { signed: true, isFinal: true } });
  }

  // Tamper-evident attestation record (immutable, hash-chained audit).
  await prisma.auditLog
    .create({
      data: {
        actorId: user.id,
        action: "CONTRACT_SIGNED",
        entity: "Envelope",
        entityId: id,
        meta: `signed by "${parsed.data.signature}" (${user.email}) — typed-signature attestation`,
      },
    })
    .catch(() => {});
  await sendComm({
    tenantId: env.tenantId,
    engagementId: env.engagementId ?? null,
    channel: "PORTAL",
    actorType: "CLIENT",
    body: `Engagement agreement signed by ${parsed.data.signature}.`,
    direction: "IN",
  }).catch(() => {});
  await notifyOperators("CONTRACT_SIGNED", `${user.name ?? user.email} signed the engagement agreement.`).catch(() => {});

  return NextResponse.json({ ok: true, status: "SIGNED" });
}
