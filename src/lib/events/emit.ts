import { Prisma } from "@prisma/client";
import { prisma } from "../db";

// Single trigger point for the autonomy pipeline. Every meaningful state change
// in the platform funnels through emitEvent: it leaves an immutable audit trail
// (AuditLog) AND enqueues a DomainEvent (status PENDING) for the agent runner to
// pick up and process. One write, two rows — keeps the trigger surface tiny.

function toJson(payload: unknown): Prisma.InputJsonValue | undefined {
  if (payload === undefined || payload === null) return undefined;
  return payload as Prisma.InputJsonValue;
}

export async function emitEvent(
  type: string,
  entity: string,
  entityId?: string,
  payload?: unknown
): Promise<string> {
  const json = toJson(payload);

  const [, domainEvent] = await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        action: type,
        entity,
        entityId: entityId ?? null,
        meta: json === undefined ? null : JSON.stringify(payload),
      },
    }),
    prisma.domainEvent.create({
      data: {
        type,
        entity,
        entityId: entityId ?? null,
        payload: json,
        status: "PENDING",
      },
    }),
  ]);

  // The DomainEvent id lets callers process this event immediately (low-latency
  // path) while the cron remains the safety net — both claim the same row, so it
  // is never processed twice.
  return domainEvent.id;
}
