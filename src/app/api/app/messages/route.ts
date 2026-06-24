import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/app-auth";
import { dbForTenant } from "@/lib/db";

// The client's conversation with Provecta — the Communication ledger for their
// tenant (both directions, every channel; the app shows the whole thread).
// Tenant-scoped via dbForTenant so a client only ever sees their own messages.
export async function GET(req: Request) {
  const user = await getAppUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.tenantId) return NextResponse.json({ messages: [] });

  const db = dbForTenant(user.tenantId);
  const rows = await db.communication.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  const messages = rows.map((c) => ({
    id: c.id,
    // IN = from the client; OUT = from Provecta (agent or human).
    from: c.direction === "IN" ? "CLIENT" : "PROVECTA",
    actorType: c.actorType,
    body: c.body,
    channel: c.channel,
    createdAt: c.createdAt,
  }));
  return NextResponse.json({ messages });
}
