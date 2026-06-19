/**
 * Honesty say-gate + PII scrub regression test.
 *
 * Money/legal claims must NEVER pass without their backing row. GENERIC always
 * passes. Personnel names must be scrubbed from client-facing copy. Pure
 * function test: no DB connection required.
 */
import { assertBacked, scrubPII } from "../src/lib/comms/honesty";

let failures = 0;
const fail = (msg: string) => {
  console.error(`FAIL: ${msg}`);
  failures++;
};

// assertBacked — money/legal gates
if (assertBacked("PAYMENT_RECEIVED", null).ok !== false) {
  fail("PAYMENT_RECEIVED with null backing must NOT pass");
}
if (assertBacked("PAYMENT_RECEIVED", { paymentReceivedAt: new Date() }).ok !== true) {
  fail("PAYMENT_RECEIVED with paymentReceivedAt must pass");
}
if (assertBacked("CONTRACT_SIGNED", { envelopeStatus: "SENT" }).ok !== false) {
  fail("CONTRACT_SIGNED with envelope SENT must NOT pass");
}
if (assertBacked("CONTRACT_SIGNED", { envelopeStatus: "SIGNED" }).ok !== true) {
  fail("CONTRACT_SIGNED with envelope SIGNED must pass");
}
if (assertBacked("GENERIC", null).ok !== true) {
  fail("GENERIC must always pass");
}

// scrubPII — no personnel names in client-facing copy
const scrubbed = scrubPII("Call Hassan Qaseem today", ["Hassan Qaseem"]);
if (scrubbed.includes("Hassan")) {
  fail(`scrubPII left a personnel name behind: "${scrubbed}"`);
}

if (failures > 0) {
  console.error(`test-honesty: ${failures} failure(s)`);
  process.exit(1);
}
console.log("test-honesty: PASS");
