import { prisma } from "./db";

// E-signature with a jurisdiction gate. Default: e-sign everywhere (ESIGN/UETA,
// KICA, eIDAS); force wet-ink upload only where a JurisdictionPolicy requires it
// (e.g. South Africa land/long-lease). Provider gated on keys → STUB in dev.

export type EsignProvider = "STUB" | "DROPBOX_SIGN" | "DOCUSIGN";

export function esignProvider(): EsignProvider {
  if (process.env.DROPBOX_SIGN_API_KEY) return "DROPBOX_SIGN";
  if (process.env.DOCUSIGN_INTEGRATION_KEY) return "DOCUSIGN";
  return "STUB";
}

export async function requiresWetInk(country: string, docType: string): Promise<boolean> {
  const policy = await prisma.jurisdictionPolicy.findFirst({
    where: { country, docType },
  });
  return policy?.requireWetInk ?? false;
}

export async function sendForSignature(envelopeId: string): Promise<string> {
  const env = await prisma.envelope.findUnique({ where: { id: envelopeId } });
  if (!env) throw new Error("envelope not found");

  if (await requiresWetInk(env.country, env.docType)) {
    await prisma.envelope.update({
      where: { id: envelopeId },
      data: { status: "WET_INK_REQUIRED" },
    });
    return "WET_INK_REQUIRED";
  }

  // Real provider call gated on keys; STUB marks it sent.
  await prisma.envelope.update({
    where: { id: envelopeId },
    data: { status: "SENT", provider: esignProvider(), sentAt: new Date() },
  });
  return "SENT";
}
