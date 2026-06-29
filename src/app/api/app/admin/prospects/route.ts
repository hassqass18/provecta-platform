import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";

// Prospect intake — the front door of the acquisition funnel. Creates the
// prospect workspace (NO login yet), captures the discovery transcript, stages a
// PROPOSED engagement + empty DRAFT proposal, and enqueues prospect RESEARCH.
// The research job then enqueues proposal generation (both land for operator
// review). Fast/no-LLM so intake is instant. SUPER_ADMIN / ADMIN.
const schema = z.object({
  company: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).optional(),
  contactEmail: z.string().email(),
  domain: z.string().trim().max(200).optional(),
  transcript: z.string().trim().max(50000).optional(),
});

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "prospect";
}

export async function POST(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Company and a valid contact email are required." }, { status: 400 });
  const { company, contactName, contactEmail, domain, transcript } = parsed.data;
  const email = contactEmail.toLowerCase();

  // The prospect's email becomes the main point of contact until they change it.
  const tenant = await prisma.tenant.create({
    data: {
      name: company,
      slug: `${slugify(company)}-${Math.random().toString(36).slice(2, 6)}`,
      type: "CLIENT",
      preferredChannel: "EMAIL",
      channelAddress: email,
    },
  });

  const count = await prisma.engagement.count();
  const code = `PRV-${tenant.slug.slice(0, 3).toUpperCase()}-${String(count + 1).padStart(3, "0")}`;
  const eng = await prisma.engagement.create({
    data: {
      tenantId: tenant.id,
      name: `${company} — Engagement`,
      code,
      status: "PROPOSED",
      summary: contactName ? `Prospect contact: ${contactName} <${email}>` : `Prospect contact: ${email}`,
      currency: "USD",
      proposal: { create: { status: "DRAFT", currency: "USD" } },
      charter: { create: { sponsor: company } },
    },
    include: { proposal: { select: { id: true } } },
  });

  if (transcript) {
    await prisma.transcript.create({
      data: { tenantId: tenant.id, engagementId: eng.id, title: `${company} — discovery`, body: transcript, source: "DISCOVERY_CALL" },
    });
  }

  // Enqueue prospect research; its handler chains proposal generation.
  await prisma.ingestJob.create({
    data: {
      tenantId: tenant.id,
      kind: "RESEARCH",
      status: "PENDING",
      payload: { company, contact: contactName ?? null, domain: domain ?? null, engagementId: eng.id },
    },
  });
  await prisma.auditLog
    .create({ data: { actorId: admin.id, action: "PROSPECT_INTAKE", entity: "Engagement", entityId: eng.id, meta: code } })
    .catch(() => {});

  return NextResponse.json({ ok: true, tenantId: tenant.id, engagementId: eng.id, proposalId: eng.proposal?.id, code });
}
