import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "@node-rs/argon2";
import { getAdminAppUser, isSuperAdmin } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { stageProjectFromTemplate } from "@/server/staging";

// New-client intake + onboarding kickoff: create the client workspace (tenant) +
// its login (CLIENT user) and stage the onboarding engagement from the template.
// SUPER_ADMIN / ADMIN only.
const schema = z.object({
  companyName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(1).max(120),
  contactEmail: z.string().email(),
  password: z.string().min(6).max(100).optional(),
  notes: z.string().trim().max(100000).optional(), // consultation/discovery notes → transcript
});

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "client";
}

export async function POST(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSuperAdmin(admin)) return NextResponse.json({ error: "Only an admin can onboard clients." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Company, contact name and a valid email are required." }, { status: 400 });
  const { companyName, contactName, contactEmail } = parsed.data;
  const email = contactEmail.toLowerCase();

  if (await prisma.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
  }

  const slug = `${slugify(companyName)}-${Math.random().toString(36).slice(2, 6)}`;
  const tempPassword = parsed.data.password ?? `Provecta-${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = await hash(tempPassword);

  const tenant = await prisma.tenant.create({
    data: { name: companyName, slug, type: "CLIENT" },
  });
  await prisma.user.create({
    data: { email, name: contactName, passwordHash, role: "CLIENT", tenantId: tenant.id },
  });

  let engagementId: string | null = null;
  try {
    const staged = await stageProjectFromTemplate(tenant.id, "onboarding");
    engagementId = staged.engagementId;
  } catch {
    // Template missing → workspace + login still created; staging can be retried.
  }

  // Capture consultation/discovery notes as the engagement's first transcript.
  if (parsed.data.notes) {
    await prisma.transcript.create({
      data: {
        tenantId: tenant.id,
        engagementId,
        title: `${companyName} — initial consultation`,
        body: parsed.data.notes,
        source: "DISCOVERY_CALL",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    tenantId: tenant.id,
    engagementId,
    login: { email, password: tempPassword },
  });
}
