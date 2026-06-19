import { prisma } from "@/lib/db";

/**
 * Outbound (and inbound-logged) communication sender.
 *
 * HARD INVARIANT: there is no external send without a logged row. The
 * Communication row is written inside a transaction and IS the auditable
 * record. External transport (WhatsApp/Slack/email) is currently gated /
 * not configured, so for now the transaction only persists the row.
 *
 * When transport keys exist, the actual external send goes inside the SAME
 * transaction so a successful send can never exist without its logged row
 * (and a logged row can be reconciled against transport state).
 */

export type SendInput = {
  tenantId: string;
  engagementId?: string | null;
  channel: string;
  actorType: "AGENT" | "HUMAN" | "CLIENT";
  body: string;
  direction?: "OUT" | "IN";
  brainQueryId?: string | null;
  autonomyState?: string | null;
};

export async function sendComm(input: SendInput) {
  const direction = input.direction ?? "OUT";

  return prisma.$transaction(async (tx) => {
    const row = await tx.communication.create({
      data: {
        tenantId: input.tenantId,
        engagementId: input.engagementId ?? null,
        direction,
        channel: input.channel,
        actorType: input.actorType,
        body: input.body,
        brainQueryId: input.brainQueryId ?? null,
        autonomyState: input.autonomyState ?? null,
      },
    });

    // When transport keys exist, the actual external send goes here, inside
    // the same txn — so an external send can never happen without this row.

    return row;
  });
}
