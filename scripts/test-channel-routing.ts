/**
 * P1C — verifies inbound routing by the client's onboarded main channel + address
 * (the same resolution the /api/webhooks/[channel] route uses).
 */
import { prisma } from "../src/lib/db";

let failures = 0;
const fail = (m: string) => { console.error(`FAIL: ${m}`); failures++; };

async function main() {
  const slug = "chan-route-test";
  await prisma.tenant.deleteMany({ where: { slug } });
  const t = await prisma.tenant.create({
    data: { name: "Chan Route Test", slug, type: "CLIENT", preferredChannel: "WHATSAPP", channelAddress: "+254700123456" },
  });

  const hit = await prisma.tenant.findFirst({ where: { preferredChannel: "WHATSAPP", channelAddress: "+254700123456" } });
  if (hit?.id !== t.id) fail("inbound from the onboarded number did not route to the client");

  const wrongChannel = await prisma.tenant.findFirst({ where: { preferredChannel: "SLACK", channelAddress: "+254700123456" } });
  if (wrongChannel) fail("matched on a different channel");

  const unknown = await prisma.tenant.findFirst({ where: { preferredChannel: "WHATSAPP", channelAddress: "+000" } });
  if (unknown) fail("unknown sender matched a client");

  await prisma.tenant.delete({ where: { id: t.id } });
  if (failures) { console.error(`test-channel-routing: ${failures} failure(s)`); process.exit(1); }
  console.log("test-channel-routing: PASS — inbound routes to the client by channel+address.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
