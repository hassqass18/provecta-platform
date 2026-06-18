import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { defaultLandingFor } from "@/lib/rbac";

// Post-login resolver: bounce an authenticated user to their role's dashboard.
// (`/` is the public marketing landing, so login can't redirect there.)
export default async function Go() {
  const u = await currentUser();
  redirect(u ? defaultLandingFor(u.role) : "/login");
}
