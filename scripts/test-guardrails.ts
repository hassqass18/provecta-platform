/**
 * bRRAIn client-agent output guardrails regression test.
 *
 * Verifies the agent never leaks contract content (unasked), IP/strategy, or
 * personnel names, and that clean operational updates pass. Pure function
 * test: no DB connection required.
 */
import { guardClientReply } from "../src/lib/agent/guardrails";
import { scrubPII } from "../src/lib/comms/honesty";

let failures = 0;
const fail = (msg: string) => {
  console.error(`FAIL: ${msg}`);
  failures++;
};

// (a) Contract reference WITHOUT an explicit client ask → must NOT auto-send.
{
  const r = guardClientReply({
    draft: "Per your contract clause 4.2 you owe the next installment.",
    clientAskedAboutContract: false,
  });
  if (r.safe !== false) fail("(a) contract reference unasked must be safe=false");
  if (!r.violations.includes("contract-reference")) {
    fail(`(a) expected contract-reference violation, got: ${r.violations.join(",")}`);
  }
}

// (b) Same draft WITH an explicit client ask about their contract → allowed.
{
  const r = guardClientReply({
    draft: "Per your contract clause 4.2 you owe the next installment.",
    clientAskedAboutContract: true,
  });
  if (r.safe !== true) {
    fail(`(b) contract reference when asked must be safe=true, got violations: ${r.violations.join(",")}`);
  }
}

// (c) Internal IP/strategy markers → internal-leak, must NOT send.
{
  const r = guardClientReply({
    draft: "Our internal margin strategy is to undercut the market for two quarters.",
  });
  if (r.safe !== false) fail("(c) internal margin/strategy must be safe=false");
  if (!r.violations.includes("internal-leak")) {
    fail(`(c) expected internal-leak violation, got: ${r.violations.join(",")}`);
  }
}

// (d) scrubPII removes a provided personnel name.
{
  const out = scrubPII("Reach out to Hassan Qaseem for next steps.", ["Hassan Qaseem"]);
  if (out.includes("Hassan")) fail(`(d) personnel name not scrubbed: "${out}"`);
  // And via the guard pipeline.
  const r = guardClientReply({
    draft: "Reach out to Hassan Qaseem for next steps.",
    personnelNames: ["Hassan Qaseem"],
  });
  if (r.text.includes("Hassan")) fail(`(d) guard pipeline left personnel name: "${r.text}"`);
}

// (e) Clean operational update → safe.
{
  const r = guardClientReply({ draft: "Your milestone is on track." });
  if (r.safe !== true) {
    fail(`(e) clean reply must be safe=true, got violations: ${r.violations.join(",")}`);
  }
}

if (failures > 0) {
  console.error(`test-guardrails: ${failures} failure(s)`);
  process.exit(1);
}
console.log("test-guardrails: PASS");
