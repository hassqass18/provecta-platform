import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { signDocPath } from "@/lib/doc-link";

// Client requests a short-lived openable link for one of their documents.
// Tenant + visibility checked before a signed link is issued.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const doc = await prisma.document.findUnique({ where: { id }, select: { tenantId: true, clientVisible: true, url: true } });
  if (!doc || doc.tenantId !== user.tenantId || !doc.clientVisible) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!doc.url || (!doc.url.startsWith("db:") && !doc.url.startsWith("blob:"))) {
    return NextResponse.json({ error: "no file content" }, { status: 404 });
  }
  return NextResponse.json({ url: signDocPath(id) });
}
