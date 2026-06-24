import { prisma } from "@/lib/db";
import { processEvent } from "./runner";

/**
 * Process a single DomainEvent by id, using the same optimistic claim the cron
 * (`agent-tick`) uses. Whoever flips PENDING → PROCESSING first wins; the other
 * caller no-ops. This lets the message-send path trigger the agent immediately
 * (near-instant client replies) while the scheduled tick stays a safety net —
 * the event is never processed twice.
 *
 * Never throws: a failure marks the event FAILED so the queue moves on.
 */
export async function processOneEvent(
  eventId: string,
): Promise<{ claimed: boolean; status?: string }> {
  const claimed = await prisma.domainEvent.updateMany({
    where: { id: eventId, status: "PENDING" },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return { claimed: false };

  const ev = await prisma.domainEvent.findUnique({ where: { id: eventId } });
  if (!ev) return { claimed: false };

  try {
    const r = await processEvent({
      id: ev.id,
      type: ev.type,
      entity: ev.entity,
      entityId: ev.entityId,
      payload: ev.payload,
    });
    await prisma.domainEvent.update({
      where: { id: ev.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
    return { claimed: true, status: r.status };
  } catch (e) {
    await prisma.domainEvent.update({
      where: { id: ev.id },
      data: { status: "FAILED", lastError: String(e) },
    });
    return { claimed: true, status: "FAILED" };
  }
}
