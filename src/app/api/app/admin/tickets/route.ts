import { NextResponse } from "next/server";
import { getAdminAppUser } from "@/lib/app-auth";
import { listTickets } from "@/server/tickets";

// Admin ticket queue. ?status=OPEN_ALL (default) | ALL | <specific status>.
export async function GET(req: Request) {
  const admin = await getAdminAppUser(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const status = new URL(req.url).searchParams.get("status") ?? "OPEN_ALL";
  return NextResponse.json({ tickets: await listTickets(status) });
}
