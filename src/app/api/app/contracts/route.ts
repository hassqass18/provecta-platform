import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/app-auth";
import { prisma } from "@/lib/db";
import { readFile } from "@/server/storage";

// Client: list this tenant's engagement agreements with their (released) body so
// the workspace can render + sign them in-app.
export async function GET(req: Request) {
  const user = await getAppUser(req);
  if (!user || !user.tenantId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const envelopes = await prisma.envelope.findMany({
    where: { tenantId: user.tenantId, docType: "AGREEMENT" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const out = await Promise.all(
    envelopes.map(async (e) => {
      let bodyMd: string | null = null;
      // Only expose the body once it's released (DRAFT stays operator-internal).
      if (e.documentId && e.status !== "DRAFT") {
        const doc = await prisma.document.findUnique({ where: { id: e.documentId }, select: { url: true, clientVisible: true } });
        if (doc?.clientVisible) {
          const file = await readFile(doc.url).catch(() => null);
          if (file) bodyMd = file.bytes.toString("utf8");
        }
      }
      return {
        id: e.id,
        title: e.title,
        status: e.status, // DRAFT | SENT | SIGNED | DECLINED | WET_INK_REQUIRED
        signerName: e.signerName,
        canSign: e.status === "SENT",
        bodyMd,
      };
    }),
  );

  return NextResponse.json({ contracts: out });
}
