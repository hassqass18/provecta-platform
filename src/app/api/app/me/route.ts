import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/app-auth";

// Returns the authenticated app user (+ their linked workspace). The app calls
// this on launch to validate a stored token and hydrate the session.
export async function GET(req: Request) {
  const user = await getAppUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ user });
}
