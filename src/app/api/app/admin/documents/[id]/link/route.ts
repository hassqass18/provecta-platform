import { NextResponse } from "next/server";
import { getAdminAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { signDocPath } from "@/lib/doc-link";

// Admin requests an openable link for any document.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id }, select: { url: true } });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!doc.url || (!doc.url.startsWith("db:") && !doc.url.startsWith("blob:"))) {
    return NextResponse.json({ error: "no file content" }, { status: 404 });
  }
  return NextResponse.json({ url: signDocPath(id) });
}
