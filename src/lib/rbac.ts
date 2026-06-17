import type { Role } from "./types";
import { ADMIN_ROLES } from "./types";

export function isAdmin(role: string | undefined | null): boolean {
  return !!role && ADMIN_ROLES.includes(role as Role);
}

export function defaultLandingFor(role: string | undefined | null): string {
  return isAdmin(role) ? "/admin" : "/portal";
}
